"""Модуль для транскрибации видео и аудио файлов с использованием Whisper"""
import os
import logging
import tempfile
import threading
import time
from queue import Queue
from pathlib import Path

logger = logging.getLogger(__name__)

# Импорт ffmpeg-python
FFMPEG_PYTHON_AVAILABLE = False
try:
    import ffmpeg
    FFMPEG_PYTHON_AVAILABLE = True
except ImportError:
    logger.warning("ffmpeg-python не установлен. Будет использован subprocess.")
    import subprocess

# Импорт faster-whisper
WHISPER_AVAILABLE = False
try:
    from faster_whisper import WhisperModel
    WHISPER_AVAILABLE = True
except ImportError:
    logger.warning("faster-whisper не установлен. Транскрибация недоступна.")

# Глобальный кэш моделей Whisper для переиспользования
_whisper_models_cache = {}
_whisper_models_lock = threading.Lock()
_whisper_models_loading = {}  # Отслеживание загрузки моделей


def get_whisper_model(model_name: str = None, device: str = None, compute_type: str = None):
    """
    Получает модель Whisper из кэша или загружает новую.
    Модели кэшируются для переиспользования и избежания конфликтов блокировок.
    
    Если параметры не переданы, используются значения из конфигурации (app.core.config).
    """
    if not WHISPER_AVAILABLE:
        raise ImportError("faster-whisper не установлен. Установите: pip install faster-whisper")
    
    # Используем значения из конфигурации, если параметры не переданы
    if model_name is None or device is None or compute_type is None:
        from app.core.config import WHISPER_MODEL, WHISPER_DEVICE, WHISPER_COMPUTE_TYPE
        model_name = model_name or WHISPER_MODEL
        device = device or WHISPER_DEVICE
        compute_type = compute_type or WHISPER_COMPUTE_TYPE
    
    cache_key = f"{model_name}_{device}_{compute_type}"
    
    # Проверяем, загружается ли модель сейчас
    while cache_key in _whisper_models_loading:
        logger.info(f"Модель {model_name} уже загружается другим процессом, ожидание...")
        import time
        time.sleep(1)  # Ждем, пока другая загрузка завершится
    
    with _whisper_models_lock:
        if cache_key not in _whisper_models_cache:
            # Помечаем, что модель загружается
            _whisper_models_loading[cache_key] = True
            try:
                logger.info(f"Загрузка модели faster-whisper в кэш: {model_name} (device={device}, compute_type={compute_type})")
                logger.info(f"Это может занять несколько минут при первой загрузке...")
                import time
                start_time = time.time()
                _whisper_models_cache[cache_key] = WhisperModel(
                    model_name, 
                    device=device, 
                    compute_type=compute_type
                )
                elapsed_time = time.time() - start_time
                logger.info(f"Модель {model_name} успешно загружена в кэш за {elapsed_time:.2f} секунд")
            except Exception as e:
                logger.error(f"Ошибка загрузки модели {model_name}: {e}", exc_info=True)
                raise
            finally:
                # Убираем флаг загрузки
                _whisper_models_loading.pop(cache_key, None)
        else:
            logger.info(f"Использование закэшированной модели: {model_name}")
        
        return _whisper_models_cache[cache_key]


def extract_number(s):
    """Извлекает число из строки для сортировки файлов"""
    return int(''.join(filter(str.isdigit, s))) if any(c.isdigit() for c in s) else None


def extract_audio(input_path, audio_path):
    """Извлекает аудио из видео или копирует аудио файл"""
    if FFMPEG_PYTHON_AVAILABLE:
        # Используем ffmpeg-python
        try:
            input_stream = ffmpeg.input(input_path)
            
            # Проверяем, является ли файл аудио
            audio_exts = ['.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg', '.wma']
            file_ext = os.path.splitext(input_path)[1].lower()
            
            if file_ext in audio_exts:
                # Это аудио файл - конвертируем в нужный формат
                output_stream = ffmpeg.output(
                    input_stream,
                    audio_path,
                    acodec='pcm_s16le',
                    ar=16000,
                    ac=1
                )
            else:
                # Это видео файл - извлекаем аудио
                output_stream = ffmpeg.output(
                    input_stream.audio,
                    audio_path,
                    acodec='pcm_s16le',
                    ar=16000,
                    ac=1
                )
            
            ffmpeg.run(output_stream, overwrite_output=True, quiet=True)
        except Exception as e:
            logger.error(f"Ошибка при использовании ffmpeg-python: {e}")
            raise
    else:
        # Fallback на subprocess
        import subprocess
        audio_exts = ['.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg', '.wma']
        file_ext = os.path.splitext(input_path)[1].lower()
        
        if file_ext in audio_exts:
            command = [
                'ffmpeg',
                '-i', input_path,
                '-acodec', 'pcm_s16le',
                '-ar', '16000',
                '-ac', '1',
                '-y', audio_path
            ]
        else:
            command = [
                'ffmpeg',
                '-i', input_path,
                '-vn',
                '-acodec', 'pcm_s16le',
                '-ar', '16000',
                '-ac', '1',
                '-y', audio_path
            ]
        
        subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def get_audio_duration(audio_path):
    """Получаем длительность аудио в секундах с помощью ffprobe"""
    if FFMPEG_PYTHON_AVAILABLE:
        # Используем ffmpeg-python
        try:
            probe = ffmpeg.probe(audio_path)
            duration = float(probe['format']['duration'])
            return duration
        except Exception as e:
            logger.error(f"Ошибка при получении длительности через ffmpeg-python: {e}")
            return 0.0
    else:
        # Fallback на subprocess
        import subprocess
        command = [
            'ffprobe',
            '-v', 'quiet',
            '-show_entries', 'format=duration',
            '-of', 'csv=p=0',
            audio_path
        ]
        result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        try:
            return float(result.stdout.strip())
        except:
            return 0.0


def transcribe_with_real_progress(model, audio_path, message_queue, idx, total_files, filename, model_name):
    """Транскрибация с приблизительным прогрессом на основе времени (faster-whisper)"""
    duration = get_audio_duration(audio_path)
    if duration == 0:
        duration = 60  # fallback

    # Оценочная скорость модели (секунд аудио в секунду времени) - faster-whisper быстрее
    speed_estimate = {
        'tiny': 1.5,
        'base': 1.2,
        'small': 0.8,
        'medium': 0.4,
        'large': 0.2
    }.get(model_name, 0.6)

    expected_time = duration * (1.0 / speed_estimate)
    start_time = time.time()
    result_text = ""

    def run_transcription():
        nonlocal result_text
        # faster-whisper возвращает генератор сегментов
        segments, info = model.transcribe(audio_path, language="ru", beam_size=5)
        text_parts = []
        for segment in segments:
            text_parts.append(segment.text)
        result_text = " ".join(text_parts)

    # Запускаем транскрибацию в отдельном потоке
    thread = threading.Thread(target=run_transcription)
    thread.start()

    # Пока поток работает — обновляем прогресс
    while thread.is_alive():
        elapsed = time.time() - start_time
        estimated_progress = min(elapsed / expected_time, 0.99)  # Не более 99%, пока не завершено
        message_queue.put({
            "status": "transcribing",
            "current_file": idx,
            "total_files": total_files,
            "progress": estimated_progress,
            "filename": filename,
            "ready": False,
        })
        time.sleep(0.3)  # Обновляем каждые 300 мс

    thread.join()

    # Возвращаем результат
    return result_text.strip()


def process_file_with_queue(model, input_file, temp_dir, idx, total_files, message_queue, model_name):
    """Обрабатывает видео или аудио файл с реальным прогрессом"""
    audio_path = os.path.join(temp_dir, f"temp_audio_{idx}.wav")
    filename = os.path.basename(input_file)

    # 1. Извлечение или конвертация аудио
    message_queue.put({
        "status": "processing_audio",
        "current_file": idx,
        "total_files": total_files,
        "progress": 0.0,
        "filename": filename,
        "ready": False,
    })

    try:
        extract_audio(input_file, audio_path)
    except Exception as e:
        message_queue.put({
            "status": "error",
            "current_file": idx,
            "total_files": total_files,
            "progress": 1.0,
            "filename": filename,
            "error": f"Failed to process audio: {str(e)}",
            "ready": True,
        })
        return None

    # 2. Транскрибация с реальным прогрессом
    try:
        text = transcribe_with_real_progress(model, audio_path, message_queue, idx, total_files, filename, model_name)
        
        # Успешное завершение
        message_queue.put({
            "status": "completed",
            "current_file": idx,
            "total_files": total_files,
            "progress": 1.0,
            "filename": filename,
            "text": text,
            "ready": True,
        })
        return text
    except Exception as e:
        message_queue.put({
            "status": "error",
            "current_file": idx,
            "total_files": total_files,
            "progress": 1.0,
            "filename": filename,
            "error": str(e),
            "ready": True,
        })
        return None


def transcribe_file(file_path: Path, model_name: str = None) -> str:
    """
    Транскрибирует один файл (видео или аудио) используя faster-whisper
    
    Args:
        file_path: Путь к файлу
        model_name: Название модели Whisper (tiny, base, small, medium, large).
                   Если не указано, используется значение из конфигурации.
    
    Returns:
        Текст транскрипта
    """
    # Используем значение из конфигурации, если не передано
    if model_name is None:
        from app.core.config import WHISPER_MODEL
        model_name = WHISPER_MODEL
    
    logger.info(f"transcribe_file вызван для файла: {file_path}, модель: {model_name}")
    
    if not WHISPER_AVAILABLE:
        raise ImportError("faster-whisper не установлен. Установите: pip install faster-whisper")
    
    # Проверяем формат файла
    video_exts = ['.mp4', '.avi', '.mov', '.mkv', '.flv', '.wmv', '.webm', '.m4v', '.3gp']
    audio_exts = ['.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg', '.wma', '.opus']
    
    file_ext = file_path.suffix.lower()
    logger.info(f"Расширение файла: {file_ext}")
    
    if file_ext not in video_exts and file_ext not in audio_exts:
        raise ValueError(f"Неподдерживаемый формат файла: {file_ext}")
    
    if not file_path.exists():
        logger.error(f"Файл не найден: {file_path} (абсолютный путь: {file_path.absolute()})")
        raise FileNotFoundError(f"Файл не найден: {file_path}")
    
    logger.info(f"Файл существует, размер: {file_path.stat().st_size / 1024 / 1024:.2f} MB")
    
    # Получаем модель из кэша (загружается один раз и переиспользуется)
    logger.info(f"Получение модели Whisper из кэша: {model_name}")
    # get_whisper_model теперь сам использует значения из конфигурации, если не переданы
    model = get_whisper_model(model_name=model_name)
    logger.info(f"Модель получена, начинаем транскрибацию")
    
    # Создаем временную директорию для аудио
    with tempfile.TemporaryDirectory() as temp_dir:
        audio_path = os.path.join(temp_dir, "temp_audio.wav")
        logger.info(f"Временная директория создана: {temp_dir}")
        
        # Извлекаем/конвертируем аудио
        logger.info(f"Начало извлечения аудио из файла: {file_path.name}")
        try:
            extract_audio(str(file_path), audio_path)
            logger.info(f"Аудио извлечено успешно: {audio_path}")
        except Exception as e:
            logger.error(f"Ошибка извлечения аудио: {e}", exc_info=True)
            raise
        
        # Проверяем, что аудио файл создан
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Аудио файл не был создан: {audio_path}")
        
        audio_size = os.path.getsize(audio_path) / 1024 / 1024
        logger.info(f"Аудио файл создан, размер: {audio_size:.2f} MB")
        
        # Транскрибируем (faster-whisper возвращает генератор сегментов)
        logger.info(f"Начало транскрибации аудио: {file_path.name}")
        try:
            segments, info = model.transcribe(audio_path, language="ru", beam_size=5)
            logger.info(f"Транскрибация запущена, язык: ru, beam_size: 5")
        except Exception as e:
            logger.error(f"Ошибка запуска транскрибации: {e}", exc_info=True)
            raise
        
        # Собираем текст из сегментов
        text_parts = []
        segment_count = 0
        for segment in segments:
            text_parts.append(segment.text)
            segment_count += 1
            if segment_count % 10 == 0:
                logger.debug(f"Обработано сегментов: {segment_count}")
        
        text = " ".join(text_parts).strip()
        logger.info(f"Транскрибация завершена: {file_path.name}, сегментов: {segment_count}, длина текста: {len(text)} символов")
        
        return text


def find_ffmpeg():
    """Находит FFmpeg в системе"""
    import os
    import subprocess
    
    # Если используется ffmpeg-python, он автоматически найдет FFmpeg
    if FFMPEG_PYTHON_AVAILABLE:
        try:
            # Проверяем доступность через ffmpeg-python
            # ffmpeg-python автоматически найдет FFmpeg в системе
            return "ffmpeg"  # ffmpeg-python найдет сам
        except:
            pass
    
    # Сначала пробуем найти в PATH
    try:
        subprocess.run(["ffmpeg", "-version"], capture_output=True, check=True, timeout=5)
        return "ffmpeg"
    except:
        pass
    
    # Ищем в стандартных местах Windows
    possible_paths = [
        r"C:\ffmpeg\bin\ffmpeg.exe",
        r"C:\Program Files\ffmpeg\bin\ffmpeg.exe",
        os.path.expanduser(r"~\ffmpeg\bin\ffmpeg.exe"),
        os.path.expanduser(r"~\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.0-full_build\bin\ffmpeg.exe"),
    ]
    
    # Ищем в папке WinGet Packages
    winget_base = os.path.expanduser(r"~\AppData\Local\Microsoft\WinGet\Packages")
    if os.path.exists(winget_base):
        for item in os.listdir(winget_base):
            if "FFmpeg" in item or "ffmpeg" in item:
                ffmpeg_candidate = os.path.join(winget_base, item, "ffmpeg-8.0-full_build", "bin", "ffmpeg.exe")
                if os.path.exists(ffmpeg_candidate):
                    possible_paths.insert(0, ffmpeg_candidate)
    
    # Проверяем каждый путь
    for path in possible_paths:
        if os.path.exists(path):
            try:
                subprocess.run([path, "-version"], capture_output=True, check=True, timeout=5)
                return path
            except:
                continue
    
    return None


def ensure_ffmpeg_in_path(ffmpeg_path: str):
    """Добавляет FFmpeg в PATH процесса, если он не в PATH"""
    if ffmpeg_path == "ffmpeg":
        return  # Уже в PATH
    
    if os.path.exists(ffmpeg_path):
        ffmpeg_dir = os.path.dirname(ffmpeg_path)
        current_path = os.environ.get("PATH", "")
        if ffmpeg_dir not in current_path:
            os.environ["PATH"] = ffmpeg_dir + os.pathsep + current_path
            logger.info(f"Добавлен путь к FFmpeg в PATH процесса: {ffmpeg_dir}")

