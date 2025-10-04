const db = require('./db');

async function addSampleCourses() {
    try {
        console.log('Adding sample courses...');
        const courses = [
            ['CSE101 - Intro to Programming'],
            ['MTH202 - Calculus II'],
            ['PHY150 - General Physics'],
            ['ENG101 - English Composition']
        ];
        
        const sql = 'INSERT INTO Courses (course_name) VALUES ?';
        await db.query(sql, [courses]);

        console.log(`${courses.length} sample courses added successfully! ✅`);

    } catch (error) {
        // Ignore duplicate entry errors, as we might run this multiple times
        if (error.code !== 'ER_DUP_ENTRY') {
            console.error('Error adding sample courses:', error);
        } else {
            console.log('Courses already exist, skipping.');
        }
    } finally {
        db.end();
    }
}

addSampleCourses();
