"""API эндпоинты для работы с тестами"""
import json
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models import Test, Question, Lecture, User, Course, ProcessedMaterial, TestAttempt, Group
from app.schemas import TestResponse, QuestionResponse

logger = logging.getLogger(__name__)


def generate_test_for_student(db: Session, lecture_id: int, student_id: int) -> Test:
    """Генерирует тест для конкретного студента"""
    try:
        from app.utils.rag import generate_questions_from_text
        
        logger.info(f"Генерируем тест для студента {student_id} по лекции {lecture_id}")
        
        # Получаем обработанные материалы
        processed_materials = db.query(ProcessedMaterial).filter(
            ProcessedMaterial.lecture_id == lecture_id,
            ProcessedMaterial.processed_text.isnot(None)
        ).all()
        
        all_questions = []
        order_index = 0
        
        # Генерируем вопросы для каждого файла отдельно
        for pm in processed_materials:
            if not pm.processed_text or not pm.processed_text.strip():
                continue
            
            text = pm.processed_text.strip()
            text_length = len(text)
            
            # Определяем количество вопросов
            if text_length < 500:
                num_questions = 2
            elif text_length < 1500:
                num_questions = 2 if text_length < 1000 else 3
            else:
                num_questions = 3
            
            # Генерируем вопросы
            questions_data = generate_questions_from_text(text, num_questions=num_questions)
            
            if questions_data and len(questions_data) > 0:
                for q_data in questions_data:
                    q_data["order_index"] = order_index
                    order_index += 1
                all_questions.extend(questions_data)
        
        if all_questions and len(all_questions) > 0:
            # Создаем тест
            test = Test(
                lecture_id=lecture_id,
                created_at=datetime.now().isoformat(),
                user_id=student_id  # Связываем тест со студентом для режима "per_student"
            )
            db.add(test)
            db.flush()
            
            # Создаем вопросы
            for q_data in all_questions:
                question = Question(
                    test_id=test.id,
                    question_text=q_data["question_text"],
                    correct_answer=q_data["correct_answer"],
                    options=q_data.get("options"),
                    question_type=q_data["question_type"],
                    order_index=q_data["order_index"]
                )
                db.add(question)
            
            db.commit()
            logger.info(f"Создан тест из {len(all_questions)} вопросов для студента {student_id}")
            return test
        else:
            logger.warning(f"Не удалось сгенерировать вопросы для студента {student_id}")
            return None
    except Exception as e:
        logger.error(f"Ошибка генерации теста для студента {student_id}: {e}", exc_info=True)
        return None

router = APIRouter()


@router.get("/lectures/{lecture_id}/test")
def get_lecture_test(
    lecture_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Получение теста для лекции"""
    lecture = db.query(Lecture).filter(Lecture.id == lecture_id).first()
    if not lecture:
        raise HTTPException(status_code=404, detail="Лекция не найдена")
    
    course = db.query(Course).filter(Course.id == lecture.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    
    # Проверяем права доступа
    if current_user.role == "teacher":
        teacher_ids = [t.id for t in course.teachers]
        if current_user.id not in teacher_ids:
            raise HTTPException(status_code=403, detail="Доступ запрещен")
    elif current_user.role == "student":
        if not lecture.published:
            raise HTTPException(status_code=403, detail="Лекция не опубликована")
        student_group_ids = [g.id for g in course.groups]
        if current_user.group_id not in student_group_ids:
            raise HTTPException(status_code=403, detail="Доступ запрещен")
    elif current_user.role == "admin":
        pass  # Админ имеет доступ
    else:
        raise HTTPException(status_code=403, detail="Доступ запрещен")
    
    # Проверяем, включена ли генерация теста
    if not lecture.generate_test:
        raise HTTPException(status_code=404, detail="Генерация теста для этой лекции отключена")
    
    # Для студентов проверяем дедлайн
    if current_user.role == "student":
        if lecture.test_deadline:
            try:
                from datetime import datetime
                deadline = datetime.fromisoformat(lecture.test_deadline)
                # Если deadline имеет таймзону, убираем её для сравнения с naive datetime
                if deadline.tzinfo is not None:
                    deadline = deadline.replace(tzinfo=None)
                now = datetime.now()
                if now > deadline:
                    # Форматируем дедлайн в локальном времени (Europe/Moscow)
                    import pytz
                    moscow_tz = pytz.timezone('Europe/Moscow')
                    # Если deadline naive, считаем его московским временем
                    if deadline.tzinfo is None:
                        deadline_local = moscow_tz.localize(deadline)
                    else:
                        deadline_local = deadline.astimezone(moscow_tz)
                    raise HTTPException(status_code=403, detail=f"Дедлайн выполнения теста истек: {deadline_local.strftime('%d.%m.%Y %H:%M')}")
            except (ValueError, TypeError) as e:
                logger.warning(f"Ошибка парсинга дедлайна: {e}")
        
        # Проверяем количество попыток
        if lecture.test_max_attempts:
            # Подсчитываем попытки студента для этого теста
            # Для режима "per_student" нужно найти тест студента
            if lecture.test_generation_mode == "per_student":
                test = db.query(Test).filter(
                    Test.lecture_id == lecture_id,
                    Test.user_id == current_user.id
                ).order_by(Test.created_at.desc()).first()
            else:
                test = db.query(Test).filter(Test.lecture_id == lecture_id).order_by(Test.created_at.desc()).first()
            
            if test:
                attempts_count = db.query(TestAttempt).filter(
                    TestAttempt.test_id == test.id,
                    TestAttempt.user_id == current_user.id
                ).count()
                
                if attempts_count >= lecture.test_max_attempts:
                    raise HTTPException(
                        status_code=403, 
                        detail=f"Превышено максимальное количество попыток ({lecture.test_max_attempts}). Вы использовали все попытки."
                    )
    
    # Если режим "per_student" и пользователь - студент, используем существующий тест или создаем новый
    if lecture.test_generation_mode == "per_student" and current_user.role == "student":
        # Сначала проверяем, есть ли уже тест для этого студента
        test = db.query(Test).filter(
            Test.lecture_id == lecture_id,
            Test.user_id == current_user.id
        ).order_by(Test.created_at.desc()).first()
        
        # Если теста нет, создаем новый
        if not test:
            test = generate_test_for_student(db, lecture_id, current_user.id)
            if not test:
                raise HTTPException(status_code=500, detail="Не удалось сгенерировать тест")
    else:
        # Получаем существующий тест
        test = db.query(Test).filter(Test.lecture_id == lecture_id).order_by(Test.created_at.desc()).first()
        
        if not test:
            raise HTTPException(status_code=404, detail="Тест для этой лекции еще не создан")
    
    # Получаем вопросы
    questions = db.query(Question).filter(Question.test_id == test.id).order_by(Question.order_index).all()
    
    # Для студентов скрываем правильные ответы (если не разрешено показывать)
    if current_user.role == "student":
        # Проверяем, можно ли показывать ответы (только после дедлайна)
        show_answers = False
        deadline_passed = False
        
        if lecture.test_deadline:
            try:
                from datetime import datetime
                deadline = datetime.fromisoformat(lecture.test_deadline)
                # Если deadline имеет таймзону, убираем её для сравнения с naive datetime
                if deadline.tzinfo is not None:
                    deadline = deadline.replace(tzinfo=None)
                now = datetime.now()
                deadline_passed = now > deadline
            except (ValueError, TypeError) as e:
                logger.warning(f"Ошибка парсинга дедлайна: {e}")
        
        # Показываем ответы только если:
        # 1. Разрешено в настройках (test_show_answers = true)
        # 2. Дедлайн истек (deadline_passed = true)
        if lecture.test_show_answers and deadline_passed:
            show_answers = True
        
        questions_data = [
            QuestionResponse(
                id=q.id,
                test_id=q.test_id,
                question_text=q.question_text,
                correct_answer=q.correct_answer if show_answers else "",  # Показываем ответы только после дедлайна
                options=q.options,
                question_type=q.question_type,
                order_index=q.order_index
            )
            for q in questions
        ]
    else:
        # Для преподавателей и админов показываем все
        questions_data = [
            QuestionResponse(
                id=q.id,
                test_id=q.test_id,
                question_text=q.question_text,
                correct_answer=q.correct_answer,
                options=q.options,
                question_type=q.question_type,
                order_index=q.order_index
            )
            for q in questions
        ]
    
    return TestResponse(
        id=test.id,
        lecture_id=test.lecture_id,
        created_at=test.created_at,
        questions=questions_data
    )


@router.post("/lectures/{lecture_id}/test/check")
def check_test_answers(
    lecture_id: int,
    answers: dict,  # {question_id: "ответ студента"}
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Проверка ответов студента на тест"""
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Только студенты могут проходить тесты")
    
    lecture = db.query(Lecture).filter(Lecture.id == lecture_id).first()
    if not lecture:
        raise HTTPException(status_code=404, detail="Лекция не найдена")
    
    if not lecture.published:
        raise HTTPException(status_code=403, detail="Лекция не опубликована")
    
    if not lecture.generate_test:
        raise HTTPException(status_code=404, detail="Генерация теста для этой лекции отключена")
    
    # Проверяем дедлайн
    if lecture.test_deadline:
        try:
            from datetime import datetime
            deadline = datetime.fromisoformat(lecture.test_deadline)
            # Если deadline имеет таймзону, убираем её для сравнения с naive datetime
            if deadline.tzinfo is not None:
                deadline = deadline.replace(tzinfo=None)
            now = datetime.now()
            if now > deadline:
                # Форматируем дедлайн в локальном времени (Europe/Moscow)
                import pytz
                moscow_tz = pytz.timezone('Europe/Moscow')
                # Если deadline naive, считаем его московским временем
                if deadline.tzinfo is None:
                    deadline_local = moscow_tz.localize(deadline)
                else:
                    deadline_local = deadline.astimezone(moscow_tz)
                raise HTTPException(status_code=403, detail=f"Дедлайн выполнения теста истек: {deadline_local.strftime('%d.%m.%Y %H:%M')}")
        except (ValueError, TypeError) as e:
            logger.warning(f"Ошибка парсинга дедлайна: {e}")
    
    # Получаем тест (для режима per_student берем тест студента)
    if lecture.test_generation_mode == "per_student":
        test = db.query(Test).filter(
            Test.lecture_id == lecture_id,
            Test.user_id == current_user.id
        ).order_by(Test.created_at.desc()).first()
    else:
        test = db.query(Test).filter(Test.lecture_id == lecture_id).order_by(Test.created_at.desc()).first()
    
    if not test:
        raise HTTPException(status_code=404, detail="Тест не найден")
    
    # Проверяем количество попыток
    if lecture.test_max_attempts:
        attempts_count = db.query(TestAttempt).filter(
            TestAttempt.test_id == test.id,
            TestAttempt.user_id == current_user.id
        ).count()
        
        if attempts_count >= lecture.test_max_attempts:
            raise HTTPException(
                status_code=403, 
                detail=f"Превышено максимальное количество попыток ({lecture.test_max_attempts}). Вы использовали все попытки."
            )
    
    # Получаем вопросы с правильными ответами
    questions = db.query(Question).filter(Question.test_id == test.id).all()
    
    results = []
    correct_count = 0
    
    for question in questions:
        student_answer = answers.get(str(question.id), "")
        
        # Для вопросов с вариантами ответов сравниваем индексы
        if question.question_type == "multiple_choice":
            try:
                student_index = int(student_answer) if student_answer else -1
                # Получаем правильный индекс из вариантов
                options = json.loads(question.options) if question.options else []
                correct_answer_text = question.correct_answer
                # Находим индекс правильного ответа
                correct_index = -1
                for idx, opt in enumerate(options):
                    if opt == correct_answer_text:
                        correct_index = idx
                        break
                
                is_correct = student_index == correct_index and student_index >= 0
            except (ValueError, json.JSONDecodeError):
                is_correct = False
                student_index = -1
        else:
            # Для открытых вопросов (если останутся)
            student_answer_text = student_answer.strip().lower()
            correct_answer_text = question.correct_answer.strip().lower()
            is_correct = student_answer_text == correct_answer_text or correct_answer_text in student_answer_text or student_answer_text in correct_answer_text
        
        if is_correct:
            correct_count += 1
        
        # Формируем ответ для студента
        student_answer_display = ""
        if question.question_type == "multiple_choice":
            try:
                options = json.loads(question.options) if question.options else []
                student_index = int(student_answer) if student_answer else -1
                if 0 <= student_index < len(options):
                    student_answer_display = options[student_index]
            except (ValueError, json.JSONDecodeError):
                student_answer_display = "Не выбран"
        else:
            student_answer_display = answers.get(str(question.id), "")
        
        results.append({
            "question_id": question.id,
            "question_text": question.question_text,
            "student_answer": student_answer_display,
            "correct_answer": question.correct_answer,
            "is_correct": is_correct
        })
    
    total_questions = len(questions)
    score = (correct_count / total_questions * 100) if total_questions > 0 else 0
    
    # Сохраняем попытку студента
    attempt = TestAttempt(
        test_id=test.id,
        user_id=current_user.id,
        answers=json.dumps(answers),
        score=correct_count,
        total_questions=total_questions,
        completed_at=datetime.now().isoformat()
    )
    db.add(attempt)
    db.flush()  # Сохраняем в БД, но не коммитим еще
    
    # Определяем, показывать ли правильные ответы
    # Правильные ответы показываются только после дедлайна (чтобы студенты не списывали)
    show_answers = False
    # Подсчитываем попытки ПОСЛЕ сохранения (включая текущую)
    attempts_count = db.query(TestAttempt).filter(
        TestAttempt.test_id == test.id,
        TestAttempt.user_id == current_user.id
    ).count()
    
    # Теперь коммитим
    db.commit()
    
    # Проверяем дедлайн для показа ответов
    deadline_passed = False
    if lecture.test_deadline:
        try:
            deadline = datetime.fromisoformat(lecture.test_deadline)
            # Если deadline имеет таймзону, убираем её для сравнения с naive datetime
            if deadline.tzinfo is not None:
                deadline = deadline.replace(tzinfo=None)
            now = datetime.now()
            deadline_passed = now > deadline
        except (ValueError, TypeError) as e:
            logger.warning(f"Ошибка парсинга дедлайна для показа ответов: {e}")
    
    # Показываем ответы только если:
    # 1. Разрешено в настройках (test_show_answers = true)
    # 2. Дедлайн истек (deadline_passed = true)
    if lecture.test_show_answers and deadline_passed:
        show_answers = True
    
    # Если не разрешено показывать ответы, скрываем их в results
    if not show_answers:
        for result in results:
            result["correct_answer"] = ""  # Скрываем правильный ответ
    
    return JSONResponse({
        "test_id": test.id,
        "total_questions": total_questions,
        "correct_answers": correct_count,
        "score": round(score, 2),
        "results": results,
        "attempts_used": attempts_count,
        "max_attempts": lecture.test_max_attempts or 1,
        "show_answers": show_answers
    })


@router.get("/lectures/{lecture_id}/test/attempts")
def get_test_attempts(
    lecture_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Получение всех попыток студента по тесту"""
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Только студенты могут просматривать свои попытки")
    
    lecture = db.query(Lecture).filter(Lecture.id == lecture_id).first()
    if not lecture:
        raise HTTPException(status_code=404, detail="Лекция не найдена")
    
    if not lecture.published:
        raise HTTPException(status_code=403, detail="Лекция не опубликована")
    
    if not lecture.generate_test:
        raise HTTPException(status_code=404, detail="Генерация теста для этой лекции отключена")
    
    # Получаем тест
    if lecture.test_generation_mode == "per_student":
        test = db.query(Test).filter(
            Test.lecture_id == lecture_id,
            Test.user_id == current_user.id
        ).order_by(Test.created_at.desc()).first()
    else:
        test = db.query(Test).filter(Test.lecture_id == lecture_id).order_by(Test.created_at.desc()).first()
    
    if not test:
        raise HTTPException(status_code=404, detail="Тест не найден")
    
    # Получаем все попытки студента
    attempts = db.query(TestAttempt).filter(
        TestAttempt.test_id == test.id,
        TestAttempt.user_id == current_user.id
    ).order_by(TestAttempt.completed_at.desc()).all()
    
    # Проверяем дедлайн для показа ответов
    deadline_passed = False
    if lecture.test_deadline:
        try:
            from datetime import timezone
            deadline = datetime.fromisoformat(lecture.test_deadline)
            # Если deadline имеет таймзону, убираем её для сравнения с naive datetime
            if deadline.tzinfo is not None:
                deadline = deadline.replace(tzinfo=None)
            now = datetime.now()
            deadline_passed = now > deadline
            logger.info(f"Дедлайн: {deadline}, Сейчас: {now}, Истек: {deadline_passed}")
        except (ValueError, TypeError) as e:
            logger.warning(f"Ошибка парсинга дедлайна: {e}")
    
    show_answers = lecture.test_show_answers and deadline_passed
    logger.info(f"test_show_answers: {lecture.test_show_answers}, deadline_passed: {deadline_passed}, show_answers: {show_answers}")
    
    # Получаем вопросы теста
    questions = db.query(Question).filter(Question.test_id == test.id).order_by(Question.order_index).all()
    questions_dict = {q.id: q for q in questions}
    
    attempts_data = []
    for attempt in attempts:
        try:
            answers = json.loads(attempt.answers)
        except (json.JSONDecodeError, TypeError):
            answers = {}
        
        results = []
        for question in questions:
            student_answer = answers.get(str(question.id), "")
            
            # Формируем результат для каждого вопроса
            # Всегда передаем correct_answer, если show_answers = True
            correct_answer_value = ""
            if show_answers:
                correct_answer_value = question.correct_answer or ""
            
            result = {
                "question_id": question.id,
                "question_text": question.question_text,
                "student_answer": student_answer,
                "correct_answer": correct_answer_value,
                "is_correct": False,
                "options": question.options
            }
            
            # Определяем правильность ответа
            if question.question_type == "multiple_choice":
                try:
                    student_index = int(student_answer) if student_answer else -1
                    options = json.loads(question.options) if question.options else []
                    correct_answer_text = question.correct_answer
                    correct_index = -1
                    for idx, opt in enumerate(options):
                        if opt == correct_answer_text:
                            correct_index = idx
                            break
                    result["is_correct"] = student_index == correct_index and student_index >= 0
                    if 0 <= student_index < len(options):
                        result["student_answer"] = options[student_index]
                except (ValueError, json.JSONDecodeError):
                    result["is_correct"] = False
            else:
                student_answer_text = student_answer.strip().lower()
                correct_answer_text = question.correct_answer.strip().lower()
                result["is_correct"] = student_answer_text == correct_answer_text or correct_answer_text in student_answer_text or student_answer_text in correct_answer_text
            
            results.append(result)
        
        attempts_data.append({
            "id": attempt.id,
            "score": attempt.score,
            "total_questions": attempt.total_questions,
            "completed_at": attempt.completed_at,
            "results": results,
            "show_answers": show_answers
        })
    
    # Вычисляем максимальную оценку
    max_score = 0
    if attempts_data:
        max_score = max(
            (attempt["score"] / attempt["total_questions"] * 100) if attempt["total_questions"] > 0 else 0
            for attempt in attempts_data
        )
    
    return JSONResponse({
        "test_id": test.id,
        "attempts": attempts_data,
        "max_attempts": lecture.test_max_attempts or 1,
        "show_answers": show_answers,
        "max_score": round(max_score, 2)
    })


@router.get("/lectures/{lecture_id}/test/all-attempts")
def get_all_test_attempts(
    lecture_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Получение всех попыток всех студентов по тесту (для преподавателя)"""
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(status_code=403, detail="Только преподаватели и админы могут просматривать все попытки")
    
    lecture = db.query(Lecture).filter(Lecture.id == lecture_id).first()
    if not lecture:
        raise HTTPException(status_code=404, detail="Лекция не найдена")
    
    # Проверяем, что преподаватель имеет доступ к курсу
    course = db.query(Course).filter(Course.id == lecture.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    
    if current_user.role == "teacher":
        teacher_ids = [t.id for t in course.teachers]
        if current_user.id not in teacher_ids:
            raise HTTPException(status_code=403, detail="Вы не являетесь преподавателем этого курса")
    
    if not lecture.generate_test:
        raise HTTPException(status_code=404, detail="Генерация теста для этой лекции отключена")
    
    # Получаем все тесты для этой лекции (в режиме "per_student" их может быть несколько)
    tests = db.query(Test).filter(Test.lecture_id == lecture_id).all()
    if not tests:
        raise HTTPException(status_code=404, detail="Тесты не найдены")
    
    # Получаем все попытки по всем тестам
    test_ids = [test.id for test in tests]
    all_attempts = db.query(TestAttempt).filter(
        TestAttempt.test_id.in_(test_ids)
    ).order_by(TestAttempt.completed_at.desc()).all()
    
    # Получаем информацию о студентах
    student_ids = list(set([attempt.user_id for attempt in all_attempts]))
    students = db.query(User).filter(User.id.in_(student_ids)).all() if student_ids else []
    students_dict = {s.id: s for s in students}
    
    # Получаем информацию о группах
    group_ids = list(set([s.group_id for s in students if s.group_id]))
    groups = db.query(Group).filter(Group.id.in_(group_ids)).all() if group_ids else []
    groups_dict = {g.id: g for g in groups}
    
    # Получаем вопросы теста (берем из первого теста, так как вопросы одинаковые)
    questions = db.query(Question).filter(Question.test_id == tests[0].id).order_by(Question.order_index).all()
    questions_dict = {q.id: q for q in questions}
    
    # Проверяем дедлайн для показа ответов
    deadline_passed = False
    if lecture.test_deadline:
        try:
            deadline = datetime.fromisoformat(lecture.test_deadline)
            if deadline.tzinfo is not None:
                deadline = deadline.replace(tzinfo=None)
            now = datetime.now()
            deadline_passed = now > deadline
        except (ValueError, TypeError) as e:
            logger.warning(f"Ошибка парсинга дедлайна: {e}")
    
    show_answers = lecture.test_show_answers and deadline_passed
    
    attempts_data = []
    for attempt in all_attempts:
        student = students_dict.get(attempt.user_id)
        if not student:
            continue
        
        try:
            answers = json.loads(attempt.answers)
        except (json.JSONDecodeError, TypeError):
            answers = {}
        
        results = []
        for question in questions:
            student_answer = answers.get(str(question.id), "")
            
            correct_answer_value = ""
            if show_answers:
                correct_answer_value = question.correct_answer or ""
            
            result = {
                "question_id": question.id,
                "question_text": question.question_text,
                "student_answer": student_answer,
                "correct_answer": correct_answer_value,
                "is_correct": False,
                "options": question.options
            }
            
            # Определяем правильность ответа
            if question.question_type == "multiple_choice":
                try:
                    student_index = int(student_answer) if student_answer else -1
                    options = json.loads(question.options) if question.options else []
                    correct_answer_text = question.correct_answer
                    correct_index = -1
                    for idx, opt in enumerate(options):
                        if opt == correct_answer_text:
                            correct_index = idx
                            break
                    result["is_correct"] = student_index == correct_index and student_index >= 0
                    if 0 <= student_index < len(options):
                        result["student_answer"] = options[student_index]
                except (ValueError, json.JSONDecodeError):
                    result["is_correct"] = False
            else:
                result["is_correct"] = student_answer.lower().strip() == question.correct_answer.lower().strip() if question.correct_answer else False
            
            results.append(result)
        
        attempts_data.append({
            "id": attempt.id,
            "test_id": attempt.test_id,
            "user_id": attempt.user_id,
            "user_name": student.full_name if student else f"Студент {attempt.user_id}",
            "user_login": student.login if student else "",
            "group_id": student.group_id if student else None,
            "group_name": groups_dict.get(student.group_id).name if student and student.group_id and student.group_id in groups_dict else None,
            "score": attempt.score,
            "total_questions": attempt.total_questions,
            "completed_at": attempt.completed_at if attempt.completed_at else None,
            "results": results,
            "show_answers": show_answers
        })
    
    # Вычисляем среднюю оценку
    if attempts_data:
        total_score = sum(a["score"] for a in attempts_data)
        total_questions = sum(a["total_questions"] for a in attempts_data)
        average_score = (total_score / total_questions * 100) if total_questions > 0 else 0
    else:
        average_score = 0
    
    # Получаем список групп и студентов для фильтров
    course_groups = course.groups
    all_course_students = []
    for group in course_groups:
        group_students = db.query(User).filter(User.group_id == group.id, User.role == "student").all()
        for student in group_students:
            all_course_students.append({
                "id": student.id,
                "name": student.full_name,
                "login": student.login,
                "group_id": group.id,
                "group_name": group.name
            })
    
    return JSONResponse({
        "lecture_id": lecture_id,
        "lecture_name": lecture.name,
        "test_max_attempts": lecture.test_max_attempts or 1,
        "test_deadline": lecture.test_deadline,
        "test_show_answers": lecture.test_show_answers,
        "deadline_passed": deadline_passed,
        "show_answers": show_answers,
        "average_score": round(average_score, 1),
        "total_attempts": len(attempts_data),
        "attempts": attempts_data,
        "groups": [{"id": g.id, "name": g.name} for g in course_groups],
        "students": all_course_students
    })

