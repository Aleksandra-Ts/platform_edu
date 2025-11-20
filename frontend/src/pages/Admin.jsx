import { useState, useEffect } from 'react'
import api from '../services/api'
import '../styles/auth.css'
import '../styles/admin.css'
import AdminHeader from '../components/admin_page/AdminHeader'
import AdminTabs from '../components/admin_page/AdminTabs'
import TeachersTab from '../components/admin_page/TeachersTab'
import StudentsTab from '../components/admin_page/StudentsTab'
import GroupsTab from '../components/admin_page/GroupsTab'
import CoursesTab from '../components/admin_page/CoursesTab'
import ExportTab from '../components/admin_page/ExportTab'
import AdminMessages from '../components/admin_page/AdminMessages'

function Admin() {
  const [activeTab, setActiveTab] = useState('teachersTab')
  const [users, setUsers] = useState([])
  const [groups, setGroups] = useState([])
  const [courses, setCourses] = useState([])
  const [message, setMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // Формы
  const [teacherForm, setTeacherForm] = useState({ login: '', password: '', last_name: '', first_name: '', middle_name: '' })
  const [studentForm, setStudentForm] = useState({ login: '', password: '', last_name: '', first_name: '', middle_name: '', group_id: '' })
  const [groupForm, setGroupForm] = useState({ name: '' })
  const [courseForm, setCourseForm] = useState({ name: '', description: '', group_ids: [], teacher_ids: [] })
  const [exportForm, setExportForm] = useState({ role: '', group_id: '' })

  // Поиск
  const [searchTeachers, setSearchTeachers] = useState('')
  const [searchStudents, setSearchStudents] = useState('')
  const [searchGroups, setSearchGroups] = useState('')
  const [searchCourses, setSearchCourses] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
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
  }

  const generatePassword = () => {
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
  }

  const showMessage = (text, isSuccess = false) => {
    if (isSuccess) {
      setSuccessMessage(text)
      setMessage('')
    } else {
      setMessage(text)
      setSuccessMessage('')
    }
  }

  const handleCreateTeacher = async (e) => {
    e.preventDefault()
    try {
      await api.createUser({ ...teacherForm, role: 'teacher', group_id: null })
      showMessage('Преподаватель успешно создан', true)
      setTeacherForm({ login: '', password: '', last_name: '', first_name: '', middle_name: '' })
      loadData()
    } catch (err) {
      showMessage(err.message)
    }
  }

  const handleCreateStudent = async (e) => {
    e.preventDefault()
    try {
      await api.createUser({ ...studentForm, role: 'student', group_id: parseInt(studentForm.group_id) })
      showMessage('Студент успешно создан', true)
      setStudentForm({ login: '', password: '', last_name: '', first_name: '', middle_name: '', group_id: '' })
      loadData()
    } catch (err) {
      showMessage(err.message)
    }
  }

  const handleCreateGroup = async (e) => {
    e.preventDefault()
    try {
      await api.createGroup(groupForm.name)
      showMessage('Группа успешно создана', true)
      setGroupForm({ name: '' })
      loadData()
    } catch (err) {
      showMessage(err.message)
    }
  }

  const handleUpdateUserGroup = async (userId, groupId) => {
    try {
      await api.updateUserGroup(userId, groupId)
      showMessage('Группа студента успешно обновлена', true)
      loadData()
    } catch (err) {
      showMessage(err.message)
    }
  }

  const handleSetTemporaryPassword = async (userId) => {
    try {
      const result = await api.setTemporaryPassword(userId)
      const password = result.temporary_password
      showMessage(`Временный пароль установлен: ${password}`, true)
      // Показываем пароль в alert для удобства копирования
      setTimeout(() => {
        alert(`Временный пароль для пользователя: ${password}\n\nСкопируйте его для передачи пользователю.`)
      }, 100)
      loadData()
    } catch (err) {
      showMessage(err.message)
    }
  }

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Вы уверены, что хотите удалить этого пользователя?')) return
    try {
      await api.deleteUser(userId)
      showMessage('Пользователь успешно удален', true)
      loadData()
    } catch (err) {
      showMessage(err.message)
    }
  }

  const handleDeleteGroup = async (groupId) => {
    if (!window.confirm('Вы уверены, что хотите удалить эту группу?')) return
    try {
      await api.deleteGroup(groupId)
      showMessage('Группа успешно удалена', true)
      loadData()
    } catch (err) {
      showMessage(err.message)
    }
  }

  const handleCreateCourse = async (e) => {
    e.preventDefault()
    try {
      await api.createCourse(courseForm)
      showMessage('Курс успешно создан', true)
      setCourseForm({ name: '', description: '', group_ids: [], teacher_ids: [] })
      loadData()
    } catch (err) {
      showMessage(err.message)
    }
  }

  const handleUpdateCourse = async (courseId, courseData) => {
    try {
      await api.updateCourse(courseId, courseData)
      showMessage('Курс успешно обновлен', true)
      loadData()
    } catch (err) {
      showMessage(err.message)
    }
  }

  const handleDeleteCourse = async (courseId) => {
    if (!window.confirm('Вы уверены, что хотите удалить этот курс?')) return
    try {
      await api.deleteCourse(courseId)
      showMessage('Курс успешно удален', true)
      loadData()
    } catch (err) {
      showMessage(err.message)
    }
  }

  const handleExport = async (e) => {
    e.preventDefault()
    try {
      await api.exportUsers(exportForm.role || null, exportForm.group_id ? parseInt(exportForm.group_id) : null)
      showMessage('Файл успешно выгружен', true)
    } catch (err) {
      showMessage(err.message)
    }
  }

  const teachersList = users.filter(u => u.role === 'teacher')
  const students = users.filter(u => u.role === 'student')
  const filteredTeachers = searchTeachers
    ? teachersList.filter(t => 
        (t.login || '').toLowerCase().includes(searchTeachers.toLowerCase()) ||
        (t.full_name || '').toLowerCase().includes(searchTeachers.toLowerCase())
      )
    : teachersList
  const filteredStudents = searchStudents
    ? students.filter(s =>
        (s.login || '').toLowerCase().includes(searchStudents.toLowerCase()) ||
        (s.full_name || '').toLowerCase().includes(searchStudents.toLowerCase()) ||
        (s.group_name || '').toLowerCase().includes(searchStudents.toLowerCase())
      )
    : students
  const filteredGroups = searchGroups
    ? groups.filter(g => g.name.toLowerCase().includes(searchGroups.toLowerCase()))
    : groups
  const filteredCourses = searchCourses
    ? courses.filter(c =>
        (c.name || '').toLowerCase().includes(searchCourses.toLowerCase()) ||
        (c.description || '').toLowerCase().includes(searchCourses.toLowerCase()) ||
        (c.group_names || []).some(gn => gn.toLowerCase().includes(searchCourses.toLowerCase())) ||
        (c.teacher_names || []).some(tn => tn.toLowerCase().includes(searchCourses.toLowerCase()))
      )
    : courses

  return (
    <main className="admin-layout">
      <section className="admin-shell">
        <AdminHeader />
        <AdminTabs activeTab={activeTab} onTabChange={setActiveTab} />

        {activeTab === 'teachersTab' && (
          <TeachersTab
            form={teacherForm}
            setForm={setTeacherForm}
            onSubmit={handleCreateTeacher}
            generatePassword={generatePassword}
            teachers={filteredTeachers}
            searchValue={searchTeachers}
            onSearchChange={setSearchTeachers}
            onDelete={handleDeleteUser}
            onSetTemporaryPassword={handleSetTemporaryPassword}
          />
        )}

        {activeTab === 'studentsTab' && (
          <StudentsTab
            form={studentForm}
            setForm={setStudentForm}
            onSubmit={handleCreateStudent}
            generatePassword={generatePassword}
            groups={groups}
            students={filteredStudents}
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
      </section>
    </main>
  )
}

export default Admin
