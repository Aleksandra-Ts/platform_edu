import { useState, useEffect, useMemo, useCallback } from 'react'
import api from '../services/api'
import { useSearchFilter } from '../hooks/useSearchFilter'
import '../styles/auth.css'
import '../styles/admin.css'
import AdminHeader from '../components/admin_page/AdminHeader'
import AdminTabs from '../components/admin_page/AdminTabs'
import UsersTab from '../components/admin_page/UsersTab'
import GroupsTab from '../components/admin_page/GroupsTab'
import CoursesTab from '../components/admin_page/CoursesTab'
import ExportTab from '../components/admin_page/ExportTab'
import AdminMessages from '../components/admin_page/AdminMessages'
import ConfirmDialog from '../components/common/ConfirmDialog'
import AlertDialog from '../components/common/AlertDialog'

function Admin() {
  const [activeTab, setActiveTab] = useState('teachersTab')
  const [users, setUsers] = useState([])
  const [groups, setGroups] = useState([])
  const [courses, setCourses] = useState([])
  const [message, setMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  
  // Состояния для модальных окон
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null })
  const [alertDialog, setAlertDialog] = useState({ isOpen: false, title: '', message: '' })

  // Формы
  const [teacherForm, setTeacherForm] = useState({ login: '', password: '', last_name: '', first_name: '', middle_name: '' })
  const [studentForm, setStudentForm] = useState({ login: '', password: '', last_name: '', first_name: '', middle_name: '', group_id: '' })
  const [groupForm, setGroupForm] = useState({ name: '' })
  const [courseForm, setCourseForm] = useState({ name: '', description: '', group_ids: [], teacher_ids: [] })
  const [exportForm, setExportForm] = useState({ role: '', group_id: '' })

  // Фильтрация данных с помощью хука (мемоизировано)
  const teachersList = useMemo(() => 
    users.filter(u => u.role === 'teacher'),
    [users]
  )
  const students = useMemo(() => 
    users.filter(u => u.role === 'student'),
    [users]
  )
  
  const {
    searchValue: searchTeachers,
    setSearchValue: setSearchTeachers,
    filteredData: filteredTeachers
  } = useSearchFilter(teachersList, (teacher) => [
    teacher.login || '',
    teacher.full_name || ''
  ])
  
  const {
    searchValue: searchStudents,
    setSearchValue: setSearchStudents,
    filteredData: filteredStudents
  } = useSearchFilter(students, (student) => [
    student.login || '',
    student.full_name || '',
    student.group_name || ''
  ])
  
  const {
    searchValue: searchGroups,
    setSearchValue: setSearchGroups,
    filteredData: filteredGroups
  } = useSearchFilter(groups, ['name'])
  
  const {
    searchValue: searchCourses,
    setSearchValue: setSearchCourses,
    filteredData: filteredCourses
  } = useSearchFilter(courses, (course) => [
    course.name || '',
    course.description || '',
    ...(course.group_names || []),
    ...(course.teacher_names || [])
  ])

  const loadData = useCallback(async () => {
    try {
      const [usersData, groupsData, coursesData] = await Promise.all([
        api.getUsers(),
        api.getGroups(),
        api.getCourses()
      ])
      setUsers(usersData)
      setGroups(groupsData)
      setCourses(coursesData)
    } catch (err) {
      setMessage(err.message)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const generatePassword = useCallback(() => {
    const length = 12
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
    let password = ''
    password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]
    password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]
    password += '0123456789'[Math.floor(Math.random() * 10)]
    password += '!@#$%^&*'[Math.floor(Math.random() * 8)]
    for (let i = password.length; i < length; i++) {
      password += charset[Math.floor(Math.random() * charset.length)]
    }
    return password.split('').sort(() => Math.random() - 0.5).join('')
  }, [])

  const showMessage = useCallback((text, isSuccess = false) => {
    if (isSuccess) {
      setSuccessMessage(text)
      setMessage('')
    } else {
      setMessage(text)
      setSuccessMessage('')
    }
  }, [])

  const handleCreateTeacher = useCallback(async (e) => {
    e.preventDefault()
    try {
      await api.createUser({ ...teacherForm, role: 'teacher', group_id: null })
      showMessage('Преподаватель успешно создан', true)
      setTeacherForm({ login: '', password: '', last_name: '', first_name: '', middle_name: '' })
      loadData()
    } catch (err) {
      showMessage(err.message)
    }
  }, [teacherForm, showMessage, loadData])

  const handleCreateStudent = useCallback(async (e) => {
    e.preventDefault()
    try {
      await api.createUser({ ...studentForm, role: 'student', group_id: parseInt(studentForm.group_id) })
      showMessage('Студент успешно создан', true)
      setStudentForm({ login: '', password: '', last_name: '', first_name: '', middle_name: '', group_id: '' })
      loadData()
    } catch (err) {
      showMessage(err.message)
    }
  }, [studentForm, showMessage, loadData])

  const handleCreateGroup = useCallback(async (e) => {
    e.preventDefault()
    try {
      await api.createGroup(groupForm.name)
      showMessage('Группа успешно создана', true)
      setGroupForm({ name: '' })
      loadData()
    } catch (err) {
      showMessage(err.message)
    }
  }, [groupForm, showMessage, loadData])

  const handleUpdateUserGroup = useCallback(async (userId, groupId) => {
    try {
      await api.updateUserGroup(userId, groupId)
      showMessage('Группа студента успешно обновлена', true)
      loadData()
    } catch (err) {
      showMessage(err.message)
    }
  }, [showMessage, loadData])

  const handleSetTemporaryPassword = useCallback(async (userId) => {
    try {
      const result = await api.setTemporaryPassword(userId)
      const password = result.temporary_password
      showMessage(`Временный пароль установлен: ${password}`, true)
      // Показываем пароль в модальном окне для удобства копирования
      setTimeout(() => {
        setAlertDialog({
          isOpen: true,
          title: 'Временный пароль установлен',
          message: `Временный пароль для пользователя: ${password}\n\nСкопируйте его для передачи пользователю.`
        })
      }, 100)
      loadData()
    } catch (err) {
      showMessage(err.message)
    }
  }, [showMessage, loadData])

  const handleDeleteUser = useCallback((userId) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Удаление пользователя',
      message: 'Вы уверены, что хотите удалить этого пользователя?',
      onConfirm: async () => {
        try {
          await api.deleteUser(userId)
          showMessage('Пользователь успешно удален', true)
          loadData()
          setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null })
        } catch (err) {
          showMessage(err.message)
          setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null })
        }
      }
    })
  }, [showMessage, loadData])

  const handleDeleteGroup = useCallback((groupId) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Удаление группы',
      message: 'Вы уверены, что хотите удалить эту группу?',
      onConfirm: async () => {
        try {
          await api.deleteGroup(groupId)
          showMessage('Группа успешно удалена', true)
          loadData()
          setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null })
        } catch (err) {
          showMessage(err.message)
          setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null })
        }
      }
    })
  }, [showMessage, loadData])

  const handleCreateCourse = useCallback(async (e) => {
    e.preventDefault()
    try {
      await api.createCourse(courseForm)
      showMessage('Курс успешно создан', true)
      setCourseForm({ name: '', description: '', group_ids: [], teacher_ids: [] })
      loadData()
    } catch (err) {
      showMessage(err.message)
    }
  }, [courseForm, showMessage, loadData])

  const handleUpdateCourse = useCallback(async (courseId, courseData) => {
    try {
      await api.updateCourse(courseId, courseData)
      showMessage('Курс успешно обновлен', true)
      loadData()
    } catch (err) {
      showMessage(err.message)
    }
  }, [showMessage, loadData])

  const handleDeleteCourse = useCallback((courseId) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Удаление курса',
      message: 'Вы уверены, что хотите удалить этот курс?',
      onConfirm: async () => {
        try {
          await api.deleteCourse(courseId)
          showMessage('Курс успешно удален', true)
          loadData()
          setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null })
        } catch (err) {
          showMessage(err.message)
          setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null })
        }
      }
    })
  }, [showMessage, loadData])

  const handleExport = useCallback(async (e) => {
    e.preventDefault()
    try {
      await api.exportUsers(exportForm.role || null, exportForm.group_id ? parseInt(exportForm.group_id) : null)
      showMessage('Файл успешно выгружен', true)
    } catch (err) {
      showMessage(err.message)
    }
  }, [exportForm, showMessage])

  const handleCloseConfirmDialog = useCallback(() => {
    setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null })
  }, [])

  const handleCloseAlertDialog = useCallback(() => {
    setAlertDialog({ isOpen: false, title: '', message: '' })
  }, [])

  return (
    <main className="admin-layout">
      <section className="admin-shell">
        <AdminHeader />
        <AdminTabs activeTab={activeTab} onTabChange={setActiveTab} />

        {activeTab === 'teachersTab' && (
          <UsersTab
            userType="teacher"
            form={teacherForm}
            setForm={setTeacherForm}
            onSubmit={handleCreateTeacher}
            generatePassword={generatePassword}
            users={filteredTeachers}
            searchValue={searchTeachers}
            onSearchChange={setSearchTeachers}
            onDelete={handleDeleteUser}
            onSetTemporaryPassword={handleSetTemporaryPassword}
          />
        )}

        {activeTab === 'studentsTab' && (
          <UsersTab
            userType="student"
            form={studentForm}
            setForm={setStudentForm}
            onSubmit={handleCreateStudent}
            generatePassword={generatePassword}
            groups={groups}
            users={filteredStudents}
            searchValue={searchStudents}
            onSearchChange={setSearchStudents}
            onDelete={handleDeleteUser}
            onUpdateGroup={handleUpdateUserGroup}
            onSetTemporaryPassword={handleSetTemporaryPassword}
          />
        )}

        {activeTab === 'groupsTab' && (
          <GroupsTab
            form={groupForm}
            setForm={setGroupForm}
            onSubmit={handleCreateGroup}
            groups={filteredGroups}
            searchValue={searchGroups}
            onSearchChange={setSearchGroups}
            onDelete={handleDeleteGroup}
          />
        )}

        {activeTab === 'coursesTab' && (
          <CoursesTab
            form={courseForm}
            setForm={setCourseForm}
            onSubmit={handleCreateCourse}
            courses={filteredCourses}
            groups={groups}
            teachers={teachersList}
            searchValue={searchCourses}
            onSearchChange={setSearchCourses}
            onEdit={handleUpdateCourse}
            onDelete={handleDeleteCourse}
          />
        )}

        {activeTab === 'exportTab' && (
          <ExportTab
            form={exportForm}
            setForm={setExportForm}
            onSubmit={handleExport}
            groups={groups}
          />
        )}

        <AdminMessages message={message} successMessage={successMessage} />
        
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={handleCloseConfirmDialog}
        />
        
        <AlertDialog
          isOpen={alertDialog.isOpen}
          title={alertDialog.title}
          message={alertDialog.message}
          onClose={handleCloseAlertDialog}
        />
      </section>
    </main>
  )
}

export default Admin
