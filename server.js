const express = require('express');
const bcrypt = require('bcrypt');
const session = require('express-session');
const path = require('path');
const db = require('./db');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Multer Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// Middleware
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'a-very-secret-key-that-should-be-changed',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// Security Middleware
const isLoggedIn = (req, res, next) => {
    if (!req.session.user) return res.redirect('/login.html');
    next();
};
const isTeacher = (req, res, next) => {
    if (req.session.user.role !== 'teacher') return res.status(403).send('Access Denied');
    next();
};
const isStudent = (req, res, next) => {
    if (req.session.user.role !== 'student') return res.status(403).send('Access Denied');
    next();
};

// Helper Functions
const generateJoinCode = (length = 6) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

// --- Authentication Routes ---
app.post('/signup', async (req, res) => {
    const { name, email, password } = req.body;

    // New rule-based authorization logic
    const studentKeywords = ['bce', 'mim', 'bai'];
    let userRole = null;

    if (email.endsWith('@vitbhopal.ac.in')) {
        // Check if any student keyword exists in the email
        const isStudent = studentKeywords.some(keyword => email.includes(keyword));
        if (isStudent) {
            userRole = 'student';
        } else {
            userRole = 'teacher';
        }
    }

    // If no role was assigned, the email is not authorized
    if (!userRole) {
        return res.send('This email address is not authorized to sign up for this portal.');
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.query('INSERT INTO Users (name, email, password, role) VALUES (?, ?, ?, ?)', [name, email, hashedPassword, userRole]);
        res.send(`<h1>Account created as a ${userRole}!</h1><p>You can now <a href="/login.html">login</a>.</p>`);
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.send('An account with this email already exists. <a href="/login.html">Login instead</a>.');
        }
        console.error('Signup Error:', error);
        res.status(500).send('An error occurred during registration.');
    }
});
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const [users] = await db.query('SELECT * FROM Users WHERE email = ?', [email]);
        if (users.length === 0) return res.send('Invalid credentials.');
        const user = users[0];
        const match = await bcrypt.compare(password, user.password);
        if (match) {
            req.session.user = { id: user.user_id, name: user.name, role: user.role };
            if (user.role === 'teacher') res.redirect('/teacher-dashboard');
            else res.redirect('/student-dashboard');
        } else {
            res.send('Invalid credentials.');
        }
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).send('Login error.');
    }
});
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) return res.send('Error logging out');
        res.redirect('/');
    });
});

// --- Page Serving Routes ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.get('/teacher-dashboard', isLoggedIn, isTeacher, (req, res) => res.sendFile(path.join(__dirname, 'views/teacher_dashboard.html')));
app.get('/student-dashboard', isLoggedIn, isStudent, (req, res) => res.sendFile(path.join(__dirname, 'views/student_dashboard.html')));
app.get('/teacher/class/:classId', isLoggedIn, isTeacher, (req, res) => res.sendFile(path.join(__dirname, 'views/class_details.html')));
app.get('/student/class/:classId', isLoggedIn, isStudent, async (req, res) => {
    const { classId } = req.params;
    const studentId = req.session.user.id;
    try {
        const [enrollment] = await db.query('SELECT * FROM Enrollments WHERE class_id = ? AND student_id = ?', [classId, studentId]);
        if (enrollment.length === 0) return res.status(403).send('Access Denied');
        res.sendFile(path.join(__dirname, 'views/student_class_view.html'));
    } catch (error) {
        res.status(500).send('Server error.');
    }
});
app.get('/student/assignment/:assignmentId', isLoggedIn, isStudent, async (req, res) => {
    const { assignmentId } = req.params;
    const studentId = req.session.user.id;
    try {
        const [assignment] = await db.query(
            `SELECT a.class_id FROM Assignments a JOIN Enrollments e ON a.class_id = e.class_id WHERE a.assignment_id = ? AND e.student_id = ?`,
            [assignmentId, studentId]
        );
        if (assignment.length === 0) return res.status(403).send('Access Denied.');
        res.sendFile(path.join(__dirname, 'views/assignment_submission.html'));
    } catch (error) {
        res.status(500).send('Server error.');
    }
});
app.get('/teacher/assignment/:assignmentId', isLoggedIn, isTeacher, async (req, res) => {
    const { assignmentId } = req.params;
    const teacherId = req.session.user.id;
    try {
        const [assignment] = await db.query(
            `SELECT a.class_id FROM Assignments a JOIN Classes c ON a.class_id = c.class_id WHERE a.assignment_id = ? AND c.teacher_id = ?`,
            [assignmentId, teacherId]
        );
        if (assignment.length === 0) return res.status(403).send('Access Denied.');
        res.sendFile(path.join(__dirname, 'views/assignment_details.html'));
    } catch (error) {
        res.status(500).send('Server error.');
    }
});

// --- Action Routes ---
app.post('/create-class', isLoggedIn, isTeacher, async (req, res) => {
    const { courseId, className, semesterName, year } = req.body;
    const teacherId = req.session.user.id;
    const joinCode = generateJoinCode();
    try {
        const sql = `INSERT INTO Classes (course_id, class_name, semester_name, year, teacher_id, join_code) VALUES (?, ?, ?, ?, ?, ?)`;
        await db.query(sql, [courseId, className, semesterName, year, teacherId, joinCode]);
        res.redirect('/teacher-dashboard?status=class_created');
    } catch (error) {
        console.error('Error creating class:', error);
        res.status(500).send('Error creating class.');
    }
});
app.post('/join-class', isLoggedIn, isStudent, async (req, res) => {
    const { joinCode } = req.body;
    const studentId = req.session.user.id;
    try {
        const [classes] = await db.query('SELECT class_id FROM Classes WHERE join_code = ?', [joinCode]);
        if (classes.length === 0) return res.send('Invalid join code.');
        const classId = classes[0].class_id;
        await db.query('INSERT INTO Enrollments (student_id, class_id) VALUES (?, ?)', [studentId, classId]);
        res.redirect('/student-dashboard');
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.send('Already enrolled.');
        res.status(500).send('Error joining class.');
    }
});
app.post('/class/:classId/upload', isLoggedIn, isTeacher, upload.array('materialFiles', 10), async (req, res) => {
    const { classId } = req.params;
    const { title, description } = req.body;
    if (!req.files || req.files.length === 0) return res.status(400).send('No files uploaded.');
    try {
        const sql = 'INSERT INTO Materials (class_id, title, description, file_path) VALUES ?';
        const values = req.files.map(file => [classId, title, description, file.filename]);
        await db.query(sql, [values]);
        res.redirect(`/teacher/class/${classId}`);
    } catch (error) {
        res.status(500).send('Error uploading materials.');
    }
});
app.post('/material/:materialId/delete', isLoggedIn, isTeacher, async (req, res) => {
    const { materialId } = req.params;
    const teacherId = req.session.user.id;
    try {
        const [materials] = await db.query(
            `SELECT m.file_path, c.class_id FROM Materials m JOIN Classes c ON m.class_id = c.class_id WHERE m.material_id = ? AND c.teacher_id = ?`,
            [materialId, teacherId]
        );
        if (materials.length === 0) return res.status(403).send('Access Denied.');
        const material = materials[0];
        const filePath = path.join(__dirname, 'uploads', material.file_path);
        fs.unlink(filePath, async (err) => {
            if (err) console.error("Error deleting file:", err);
            await db.query('DELETE FROM Materials WHERE material_id = ?', [materialId]);
            res.redirect(`/teacher/class/${material.class_id}`);
        });
    } catch (error) {
        res.status(500).send('Error deleting material.');
    }
});
app.post('/class/:classId/delete', isLoggedIn, isTeacher, async (req, res) => {
    const { classId } = req.params;
    const teacherId = req.session.user.id;
    try {
        const [classCheck] = await db.query('SELECT * FROM Classes WHERE class_id = ? AND teacher_id = ?', [classId, teacherId]);
        if (classCheck.length === 0) return res.status(403).send('Access Denied.');
        const [assignments] = await db.query('SELECT assignment_id FROM Assignments WHERE class_id = ?', [classId]);
        if (assignments.length > 0) {
            const assignmentIds = assignments.map(a => a.assignment_id);
            const [assignmentFiles] = await db.query('SELECT file_path FROM AssignmentFiles WHERE assignment_id IN (?)', [assignmentIds]);
            assignmentFiles.forEach(file => {
                fs.unlink(path.join(__dirname, 'uploads', file.file_path), err => { if (err) console.error(err); });
            });
            const [submissions] = await db.query('SELECT file_path FROM Submissions WHERE assignment_id IN (?)', [assignmentIds]);
            submissions.forEach(sub => {
                fs.unlink(path.join(__dirname, 'uploads', sub.file_path), err => { if (err) console.error(err); });
            });
            await db.query('DELETE FROM AssignmentFiles WHERE assignment_id IN (?)', [assignmentIds]);
            await db.query('DELETE FROM Submissions WHERE assignment_id IN (?)', [assignmentIds]);
            await db.query('DELETE FROM Assignments WHERE class_id = ?', [classId]);
        }
        const [materials] = await db.query('SELECT file_path FROM Materials WHERE class_id = ?', [classId]);
        materials.forEach(material => {
            fs.unlink(path.join(__dirname, 'uploads', material.file_path), err => { if (err) console.error(err); });
        });
        await db.query('DELETE FROM Materials WHERE class_id = ?', [classId]);
        await db.query('DELETE FROM Enrollments WHERE class_id = ?', [classId]);
        await db.query('DELETE FROM Classes WHERE class_id = ?', [classId]);
        res.redirect('/teacher-dashboard?status=class_deleted');
    } catch (error) {
        res.status(500).send('Error deleting class.');
    }
});
app.post('/class/:classId/create-assignment', isLoggedIn, isTeacher, upload.array('assignmentFiles', 10), async (req, res) => {
    const { classId } = req.params;
    const { title, description, dueDate, dueTime } = req.body;
    const teacherId = req.session.user.id;
    const dueDateTime = `${dueDate} ${dueTime}`;
    try {
        const [classCheck] = await db.query('SELECT * FROM Classes WHERE class_id = ? AND teacher_id = ?', [classId, teacherId]);
        if (classCheck.length === 0) return res.status(403).send('Access Denied.');
        const assignmentSql = `INSERT INTO Assignments (class_id, title, description, due_date) VALUES (?, ?, ?, ?)`;
        const [result] = await db.query(assignmentSql, [classId, title, description, dueDateTime]);
        const assignmentId = result.insertId;
        if (req.files && req.files.length > 0) {
            const fileSql = 'INSERT INTO AssignmentFiles (assignment_id, file_path, original_name) VALUES ?';
            const fileValues = req.files.map(file => [assignmentId, file.filename, file.originalname]);
            await db.query(fileSql, [fileValues]);
        }
        res.redirect(`/teacher/class/${classId}`);
    } catch (error) {
        res.status(500).send('Error creating assignment.');
    }
});
app.post('/assignment/:assignmentId/submit', isLoggedIn, isStudent, upload.single('submissionFile'), async (req, res) => {
    const { assignmentId } = req.params;
    const studentId = req.session.user.id;
    if (!req.file) return res.status(400).send('No file uploaded.');
    try {
        const [assignment] = await db.query(
            `SELECT a.class_id, a.due_date FROM Assignments a JOIN Enrollments e ON a.class_id = e.class_id WHERE a.assignment_id = ? AND e.student_id = ?`,
            [assignmentId, studentId]
        );
        if (assignment.length === 0) return res.status(403).send('Access Denied.');
        const [existingSubmission] = await db.query('SELECT * FROM Submissions WHERE assignment_id = ? AND student_id = ?', [assignmentId, studentId]);
        if (existingSubmission.length > 0) return res.send('Already submitted.');
        const dueDate = new Date(assignment[0].due_date);
        const submissionDate = new Date();
        const isLate = submissionDate > dueDate;
        const sql = `INSERT INTO Submissions (assignment_id, student_id, file_path, is_late) VALUES (?, ?, ?, ?)`;
        await db.query(sql, [assignmentId, studentId, req.file.filename, isLate]);
        res.redirect(`/student/assignment/${assignmentId}`);
    } catch (error) {
        res.status(500).send('Error submitting assignment.');
    }
});
app.post('/assignment/:assignmentId/delete', isLoggedIn, isTeacher, async (req, res) => {
    const { assignmentId } = req.params;
    const teacherId = req.session.user.id;
    try {
        const [assignment] = await db.query(
            `SELECT a.class_id FROM Assignments a JOIN Classes c ON a.class_id = c.class_id WHERE a.assignment_id = ? AND c.teacher_id = ?`,
            [assignmentId, teacherId]
        );
        if (assignment.length === 0) return res.status(403).send('Access Denied.');
        const { class_id } = assignment[0];
        const [assignmentFiles] = await db.query('SELECT file_path FROM AssignmentFiles WHERE assignment_id = ?', [assignmentId]);
        assignmentFiles.forEach(file => {
            fs.unlink(path.join(__dirname, 'uploads', file.file_path), err => {
                if (err) console.error(`Failed to delete assignment file: ${file.file_path}`, err);
            });
        });
        const [submissions] = await db.query('SELECT file_path FROM Submissions WHERE assignment_id = ?', [assignmentId]);
        submissions.forEach(sub => {
            fs.unlink(path.join(__dirname, 'uploads', sub.file_path), err => {
                if (err) console.error(`Failed to delete submission file: ${sub.file_path}`, err);
            });
        });
        await db.query('DELETE FROM AssignmentFiles WHERE assignment_id = ?', [assignmentId]);
        await db.query('DELETE FROM Submissions WHERE assignment_id = ?', [assignmentId]);
        await db.query('DELETE FROM Assignments WHERE assignment_id = ?', [assignmentId]);
        res.redirect(`/teacher/class/${class_id}`);
    } catch (error) {
        res.status(500).send('Error deleting assignment.');
    }
});
app.post('/api/submission/:submissionId/grade', isLoggedIn, isTeacher, async (req, res) => {
    const { submissionId } = req.params;
    const { grade, feedback } = req.body;
    const teacherId = req.session.user.id;
    try {
        const [submission] = await db.query(
            `SELECT s.submission_id FROM Submissions s JOIN Assignments a ON s.assignment_id = a.assignment_id JOIN Classes c ON a.class_id = c.class_id WHERE s.submission_id = ? AND c.teacher_id = ?`,
            [submissionId, teacherId]
        );
        if (submission.length === 0) return res.status(403).json({ message: 'Access Denied.' });
        const sql = `UPDATE Submissions SET grade = ?, feedback = ? WHERE submission_id = ?`;
        await db.query(sql, [grade, feedback, submissionId]);
        res.status(200).json({ message: 'Grade saved successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Error grading submission.' });
    }
});

// --- API Routes ---
app.get('/api/courses', isLoggedIn, isTeacher, async (req, res) => {
    try {
        const [courses] = await db.query('SELECT * FROM Courses ORDER BY course_name');
        res.json(courses);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching courses' });
    }
});
app.get('/api/teacher/classes', isLoggedIn, isTeacher, async (req, res) => {
    const teacherId = req.session.user.id;
    try {
        const [classes] = await db.query(
            `SELECT c.class_id, c.class_name, c.join_code, co.course_name, c.semester_name, c.year FROM Classes c JOIN Courses co ON c.course_id = co.course_id WHERE c.teacher_id = ? ORDER BY c.created_at DESC`,
            [teacherId]
        );
        res.json(classes);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching teacher classes' });
    }
});
app.get('/api/student/classes', isLoggedIn, isStudent, async (req, res) => {
    const studentId = req.session.user.id;
    try {
        const [enrolledClasses] = await db.query(
            `SELECT cl.class_id, cl.class_name, co.course_name, u.name AS teacher_name, cl.semester_name, cl.year FROM Enrollments e JOIN Classes cl ON e.class_id = cl.class_id JOIN Courses co ON cl.course_id = co.course_id JOIN Users u ON cl.teacher_id = u.user_id WHERE e.student_id = ?`,
            [studentId]
        );
        res.json(enrolledClasses);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching student classes' });
    }
});
app.get('/api/teacher/class/:classId', isLoggedIn, isTeacher, async (req, res) => {
    const { classId } = req.params;
    try {
        const [results] = await db.query(
            `SELECT c.class_name, co.course_name FROM Classes c JOIN Courses co ON c.course_id = co.course_id WHERE c.class_id = ? AND c.teacher_id = ?`,
            [classId, req.session.user.id]
        );
        if (results.length === 0) return res.status(404).json({ message: 'Not found' });
        res.json(results[0]);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});
app.get('/api/student/class/:classId/details', isLoggedIn, isStudent, async (req, res) => {
    const { classId } = req.params;
    const studentId = req.session.user.id;
    try {
        const [enrollment] = await db.query('SELECT * FROM Enrollments WHERE class_id = ? AND student_id = ?', [classId, studentId]);
        if (enrollment.length === 0) return res.status(403).json({ message: 'Access Denied' });
        const [details] = await db.query(
            `SELECT cl.class_name, u.name AS teacher_name FROM Classes cl JOIN Users u ON cl.teacher_id = u.user_id WHERE cl.class_id = ?`,
            [classId]
        );
        if (details.length === 0) return res.status(404).json({ message: 'Class not found' });
        res.json(details[0]);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
});
app.get('/api/class/:classId/materials', isLoggedIn, async (req, res) => {
    const { classId } = req.params;
    const user = req.session.user;
    try {
        if (user.role === 'student') {
            const [enrollment] = await db.query('SELECT * FROM Enrollments WHERE class_id = ? AND student_id = ?', [classId, user.id]);
            if (enrollment.length === 0) return res.status(403).json({ message: 'Access Denied' });
        } else if (user.role === 'teacher') {
            const [classInfo] = await db.query('SELECT * FROM Classes WHERE class_id = ? AND teacher_id = ?', [classId, user.id]);
            if (classInfo.length === 0) return res.status(403).json({ message: 'Access Denied' });
        }
        const [materials] = await db.query('SELECT * FROM Materials WHERE class_id = ? ORDER BY uploaded_at DESC', [classId]);
        res.json(materials);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching materials' });
    }
});
app.get('/api/class/:classId/students', isLoggedIn, isTeacher, async (req, res) => {
    const { classId } = req.params;
    const teacherId = req.session.user.id;
    try {
        const [classCheck] = await db.query('SELECT class_id FROM Classes WHERE class_id = ? AND teacher_id = ?', [classId, teacherId]);
        if (classCheck.length === 0) return res.status(403).json({ message: 'Access Denied' });
        const [students] = await db.query(
            `SELECT u.name, u.email FROM Users u JOIN Enrollments e ON u.user_id = e.student_id WHERE e.class_id = ? ORDER BY u.name`,
            [classId]
        );
        res.json(students);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching student list.' });
    }
});
app.get('/api/class/:classId/assignments', isLoggedIn, async (req, res) => {
    const { classId } = req.params;
    const user = req.session.user;
    try {
        if (user.role === 'student') {
            const [enrollment] = await db.query('SELECT * FROM Enrollments WHERE class_id = ? AND student_id = ?', [classId, user.id]);
            if (enrollment.length === 0) return res.status(403).json({ message: 'Access Denied' });
        } else if (user.role === 'teacher') {
            const [classInfo] = await db.query('SELECT * FROM Classes WHERE class_id = ? AND teacher_id = ?', [classId, user.id]);
            if (classInfo.length === 0) return res.status(403).json({ message: 'Access Denied' });
        }
        const [assignments] = await db.query('SELECT * FROM Assignments WHERE class_id = ? ORDER BY due_date ASC', [classId]);
        for (const assignment of assignments) {
            const [files] = await db.query('SELECT * FROM AssignmentFiles WHERE assignment_id = ?', [assignment.assignment_id]);
            assignment.files = files;
        }
        res.json(assignments);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});
app.get('/api/student/assignment/:assignmentId/details', isLoggedIn, isStudent, async (req, res) => {
    const { assignmentId } = req.params;
    const studentId = req.session.user.id;
    try {
        const [details] = await db.query(
            `SELECT a.title, a.description, a.due_date, c.class_name, c.class_id FROM Assignments a JOIN Classes c ON a.class_id = c.class_id JOIN Enrollments e ON a.class_id = e.class_id WHERE a.assignment_id = ? AND e.student_id = ?`,
            [assignmentId, studentId]
        );
        if (details.length === 0) return res.status(404).json({ message: 'Not found' });
        const [files] = await db.query('SELECT * FROM AssignmentFiles WHERE assignment_id = ?', [assignmentId]);
        details[0].files = files;
        res.json(details[0]);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});
app.get('/api/assignment/:assignmentId/submission-status', isLoggedIn, isStudent, async (req, res) => {
    const { assignmentId } = req.params;
    const studentId = req.session.user.id;
    try {
        const [submission] = await db.query('SELECT file_path, submitted_at, is_late, grade, feedback FROM Submissions WHERE assignment_id = ? AND student_id = ?', [assignmentId, studentId]);
        if (submission.length > 0) res.json({ submitted: true, ...submission[0] });
        else res.json({ submitted: false });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});
app.get('/api/teacher/assignment/:assignmentId/details', isLoggedIn, isTeacher, async (req, res) => {
    const { assignmentId } = req.params;
    const teacherId = req.session.user.id;
    try {
        const [details] = await db.query(
            `SELECT a.title, a.description, a.due_date, c.class_name, c.class_id FROM Assignments a JOIN Classes c ON a.class_id = c.class_id WHERE a.assignment_id = ? AND c.teacher_id = ?`,
            [assignmentId, teacherId]
        );
        if (details.length === 0) return res.status(404).json({ message: 'Not found' });
        res.json(details[0]);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});
app.get('/api/assignment/:assignmentId/submissions', isLoggedIn, isTeacher, async (req, res) => {
    const { assignmentId } = req.params;
    const teacherId = req.session.user.id;
    try {
        const [assignmentCheck] = await db.query(
            `SELECT a.class_id FROM Assignments a JOIN Classes c ON a.class_id = c.class_id WHERE a.assignment_id = ? AND c.teacher_id = ?`,
            [assignmentId, teacherId]
        );
        if (assignmentCheck.length === 0) return res.status(403).json({ message: 'Access denied.' });
        const [submissions] = await db.query(
            `SELECT u.name, u.email, s.submission_id, s.submitted_at, s.file_path, s.grade, s.feedback, s.is_late FROM Submissions s JOIN Users u ON s.student_id = u.user_id WHERE s.assignment_id = ? ORDER BY s.submitted_at DESC`,
            [assignmentId]
        );
        res.json(submissions);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});
app.get('/api/student/upcoming-assignments', isLoggedIn, isStudent, async (req, res) => {
    const studentId = req.session.user.id;
    try {
        const sql = `
            SELECT a.assignment_id, a.title, a.due_date, c.class_name
            FROM Assignments a
            JOIN Enrollments e ON a.class_id = e.class_id
            JOIN Classes c ON a.class_id = c.class_id
            WHERE e.student_id = ? AND a.due_date >= CURDATE()
            ORDER BY a.due_date ASC
        `;
        const [assignments] = await db.query(sql, [studentId]);
        res.json(assignments);
    } catch (error) {
        console.error('Error fetching upcoming assignments:', error);
        res.status(500).json({ message: 'Server error' });
    }
});
app.post('/api/submission/:submissionId/grade', isLoggedIn, isTeacher, async (req, res) => {
    const { submissionId } = req.params;
    const { grade, feedback } = req.body;
    const teacherId = req.session.user.id;
    try {
        const [submission] = await db.query(
            `SELECT s.submission_id FROM Submissions s JOIN Assignments a ON s.assignment_id = a.assignment_id JOIN Classes c ON a.class_id = c.class_id WHERE s.submission_id = ? AND c.teacher_id = ?`,
            [submissionId, teacherId]
        );
        if (submission.length === 0) return res.status(403).json({ message: 'Access Denied.' });
        const sql = `UPDATE Submissions SET grade = ?, feedback = ? WHERE submission_id = ?`;
        await db.query(sql, [grade, feedback, submissionId]);
        res.status(200).json({ message: 'Grade saved successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Error grading submission.' });
    }
});

// --- Start the Server ---
app.listen(PORT, () => {
    console.log(`Server is live on http://localhost:${PORT}`);
});