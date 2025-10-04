const mysql = require('mysql2/promise');

const initialConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    port: 3307 // Or 3307, whichever port you are using
};

async function setup() {
    let connection;
    try {
        console.log('Connecting to MySQL server...');
        connection = await mysql.createConnection(initialConfig);
        await connection.query(`CREATE DATABASE IF NOT EXISTS portal_db;`);
        console.log("Database 'portal_db' created or already exists.");
        await connection.query(`USE portal_db;`);
        console.log("Switched to 'portal_db' database.");

        const usersTableQuery = `
            CREATE TABLE IF NOT EXISTS Users (
                user_id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                role ENUM('student', 'teacher') NOT NULL
            );`;
        await connection.query(usersTableQuery);
        console.log("Table 'Users' created or already exists.");

        const coursesTableQuery = `
            CREATE TABLE IF NOT EXISTS Courses (
                course_id INT AUTO_INCREMENT PRIMARY KEY,
                course_name VARCHAR(255) NOT NULL UNIQUE
            );`;
        await connection.query(coursesTableQuery);
        console.log("Table 'Courses' created or already exists.");

        const classesTableQuery = `
            CREATE TABLE IF NOT EXISTS Classes (
                class_id INT AUTO_INCREMENT PRIMARY KEY,
                class_name VARCHAR(255) NOT NULL,
                join_code VARCHAR(10) NOT NULL UNIQUE,
                course_id INT,
                teacher_id INT,
                semester_name VARCHAR(255),
                year INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (course_id) REFERENCES Courses(course_id),
                FOREIGN KEY (teacher_id) REFERENCES Users(user_id)
            );`;
        await connection.query(classesTableQuery);
        console.log("Table 'Classes' created or already exists.");

        const enrollmentsTableQuery = `
            CREATE TABLE IF NOT EXISTS Enrollments (
                enrollment_id INT AUTO_INCREMENT PRIMARY KEY,
                student_id INT NOT NULL,
                class_id INT NOT NULL,
                enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (student_id) REFERENCES Users(user_id),
                FOREIGN KEY (class_id) REFERENCES Classes(class_id),
                UNIQUE KEY (student_id, class_id)
            );`;
        await connection.query(enrollmentsTableQuery);
        console.log("Table 'Enrollments' created or already exists.");

        const materialsTableQuery = `
            CREATE TABLE IF NOT EXISTS Materials (
                material_id INT AUTO_INCREMENT PRIMARY KEY,
                class_id INT,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                file_path VARCHAR(255) NOT NULL,
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (class_id) REFERENCES Classes(class_id)
            );`;
        await connection.query(materialsTableQuery);
        console.log("Table 'Materials' created or already exists.");

        const assignmentsTableQuery = `
            CREATE TABLE IF NOT EXISTS Assignments (
                assignment_id INT AUTO_INCREMENT PRIMARY KEY,
                class_id INT,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                due_date DATETIME,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (class_id) REFERENCES Classes(class_id)
            );`;
        await connection.query(assignmentsTableQuery);
        console.log("Table 'Assignments' created or already exists.");

        const assignmentFilesTableQuery = `
            CREATE TABLE IF NOT EXISTS AssignmentFiles (
                file_id INT AUTO_INCREMENT PRIMARY KEY,
                assignment_id INT,
                file_path VARCHAR(255) NOT NULL,
                original_name VARCHAR(255),
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (assignment_id) REFERENCES Assignments(assignment_id)
            );`;
        await connection.query(assignmentFilesTableQuery);
        console.log("Table 'AssignmentFiles' created or already exists.");

        const submissionsTableQuery = `
            CREATE TABLE IF NOT EXISTS Submissions (
                submission_id INT AUTO_INCREMENT PRIMARY KEY,
                assignment_id INT,
                student_id INT,
                file_path VARCHAR(255) NOT NULL,
                submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                grade VARCHAR(255),
                feedback TEXT,
                is_late BOOLEAN DEFAULT FALSE,
                FOREIGN KEY (assignment_id) REFERENCES Assignments(assignment_id),
                FOREIGN KEY (student_id) REFERENCES Users(user_id)
            );`;
        await connection.query(submissionsTableQuery);
        console.log("Table 'Submissions' created or already exists.");

        console.log('✅ Database setup complete!');

    } catch (error) {
        console.error('Error setting up the database:', error);
    } finally {
        if (connection) {
            await connection.end();
            console.log('Connection closed.');
        }
    }
}

setup();