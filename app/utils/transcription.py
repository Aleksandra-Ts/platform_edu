"""Модуль для транскрибации видео и аудио файлов с использованием Whisper"""
import os
import subprocess
import logging
import tempfile
import threading
import time
from queue import Queue
from pathlib import Path

logger = logging.getLogger(__name__)

# Импорт Whisper
WHISPER_AVAILABLE = False
try:
    import whisper
    WHISPER_AVAILABLE = True
except ImportError:
    logger.warning("Whisper не установлен. Транскрибация недоступна.")


def extract_number(s):
    """Извлекает число из строки для сортировки файлов"""
    return int(''.join(filter(str.isdigit, s))) if any(c.isdigit() for c in s) else None


def extract_audio(input_path, audio_path):
    """Извлекает аудио из видео или копирует аудио файл"""
    # Проверяем, является ли файл аудио
    audio_exts = ['.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg', '.wma']
    file_ext = os.path.splitext(input_path)[1].lower()
    
    if file_ext in audio_exts:
        # Это аудио файл - конвертируем в нужный формат
        command = [
            'ffmpeg',
            '-i', input_path,
            '-acodec', 'pcm_s16le',
            '-ar', '16000',
            '-ac', '1',
            '-y', audio_path
        ]
    else:
        # Это видео файл - извлекаем аудио
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
    """Транскрибация с приблизительным прогрессом на основе времени"""
    duration = get_audio_duration(audio_path)
    if duration == 0:
        duration = 60  # fallback

    # Оценочная скорость модели (секунд аудио в секунду времени)
    speed_estimate = {
        'tiny': 0.8,
        'base': 0.6,
        'small': 0.4,
        'medium': 0.2,
        'large': 0.1
    }.get(model_name, 0.3)

    expected_time = duration * (1.0 / speed_estimate)
    start_time = time.time()
    result = {"text": ""}

    def run_transcription():
        nonlocal result
        result = model.transcribe(audio_path, fp16=False, task="transcribe", verbose=False, language="ru")

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
    return result["text"].strip()


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


def transcribe_file(file_path: Path, model_name: str = "base") -> str:
    """
    Транскрибирует один файл (видео или аудио)
    
    Args:
        file_path: Путь к файлу
        model_name: Название модели Whisper (tiny, base, small, medium, large)
    
    Returns:
        Текст транскрипта
    """
    if not WHISPER_AVAILABLE:
        raise ImportError("Whisper не установлен. Установите: pip install openai-whisper")
    
    # Проверяем формат файла
    video_exts = ['.mp4', '.avi', '.mov', '.mkv', '.flv', '.wmv', '.webm', '.m4v', '.3gp']
    audio_exts = ['.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg', '.wma', '.opus']
    
    file_ext = file_path.suffix.lower()
    if file_ext not in video_exts and file_ext not in audio_exts:
        raise ValueError(f"Неподдерживаемый формат файла: {file_ext}")
    
    if not file_path.exists():
        raise FileNotFoundError(f"Файл не найден: {file_path}")
    
    # Загружаем модель
    logger.info(f"Загрузка модели Whisper: {model_name}")
    model = whisper.load_model(model_name)
    
    # Создаем временную директорию для аудио
    with tempfile.TemporaryDirectory() as temp_dir:
        audio_path = os.path.join(temp_dir, "temp_audio.wav")
        
        # Извлекаем/конвертируем аудио
        logger.info(f"Обработка аудио из файла: {file_path.name}")
        extract_audio(str(file_path), audio_path)
        
        # Транскрибируем
        logger.info(f"Начало транскрибации: {file_path.name}")
        result = model.transcribe(audio_path, fp16=False, task="transcribe", verbose=False, language="ru")
        
        text = result["text"].strip()
        logger.info(f"Транскрибация завершена: {file_path.name}")
        
        return text


def find_ffmpeg():
    """Находит FFmpeg в системе"""
    import os
    
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

