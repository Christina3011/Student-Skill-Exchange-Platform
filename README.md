# Student Skill Exchange Platform

A beginner-friendly web application where students can share skills, find learning partners, and request learning sessions.

## Technology
- Frontend: HTML, CSS, JavaScript, Bootstrap
- Backend: Node.js and Express
- Database: MongoDB

## Requirements
Install Node.js and MongoDB Community Server. Make sure MongoDB is running.

## Run the project
1. Open this project folder in VS Code.
2. Open the terminal in the project folder.
3. Install dependencies:

   npm install

4. Start the website:

   npm start

5. Open http://localhost:3000 in your browser.

## Database
By default, the app connects to `mongodb://127.0.0.1:27017/student_skill_exchange`.
If your MongoDB setup uses another connection string, create a `.env` file in the project folder and add:

MONGODB_URI=mongodb://127.0.0.1:27017/student_skill_exchange
PORT=3000

## Notes
- Create an account from Register before using the dashboard.
- Passwords are hashed before being stored.
- This is a simple student project. For real-world use, add stronger validation, email verification, and production security settings.
