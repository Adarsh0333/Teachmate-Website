# 📘 College Resource Portal

This is a web-based portal for teachers and students to share resources and manage assignments.

---
## Part 1: Software Installation 🛠️
Before you begin, you must install the following software on your computer.

1.  **Node.js**
    * **What it is:** The JavaScript runtime that runs our backend server.
    * **Download:** [nodejs.org](https://nodejs.org/) (download the LTS version).

2.  **XAMPP**
    * **What it is:** A program that runs the MySQL database on our computer. We only need it for the database.
    * **Download:** [apachefriends.org](https://www.apachefriends.org/download.html)

3.  **Git & GitHub Desktop**
    * **What it is:** Git tracks our code changes, and GitHub Desktop is the app we use to sync our code with the team.
    * **Download Git:** [git-scm.com](https://git-scm.com/downloads)
    * **Download GitHub Desktop:** [desktop.github.com](https://desktop.github.com/)

---
## Part 2: Project Setup 🚀
Follow these steps in order to get the project running on your machine.

### Step 1: Clone the Project
This command downloads the project folder from GitHub to your computer.
* Open the **GitHub Desktop app**.
* Go to `File > Clone Repository...`.
* Select this repository from the list and choose where you want to save it.

### Step 2: Open the Project in VS Code
* Open the **Visual Studio Code** app.
* Go to `File > Open Folder...` and select the `portal-js` folder you just cloned.

### Step 3: Install Dependencies
This command reads the `package.json` file and downloads all the necessary code libraries (like Express) that our project depends on.
* In VS Code, open the terminal (`Terminal > New Terminal`).
* In the terminal, run the following command:
    ```bash
    npm install
    ```

### Step 4: Set Up the Database
This process prepares the database with the required tables and sample data.
1.  **Start MySQL:** Open the **XAMPP Control Panel** and click the **Start** button next to **MySQL**. Wait for it to turn green.
2.  **Create Tables:** In the VS Code terminal, run this script to build the database structure:
    ```bash
    node setupDatabase.js
    ```
3.  **Add Sample Data:** In the same terminal, run these two scripts to add the initial data:
    ```bash
    node addEmails.js
    ```
    ```bash
    node addCourses.js
    ```

---
## Part 3: Running the Application ▶️

### Step 1: Start the Server
This command starts the backend server.
* In the VS Code terminal, run:
    ```bash
    node server.js
    ```
* You should see the message: `Server is live on http://localhost:3000`.

### Step 2: View the App
* Open your web browser and go to the following address:
    [http://localhost:3000](http://localhost:3000)

---
## Sample Login Credentials
After setting up, you must first **Sign Up** using the emails below to create the accounts.

For Student – IT MUIST INCLUDE ANY OF (bce,mim,bai) and should end with                        @vitbhopal.ac.in

For Teacher- IT MUST END WITH @vitbhopal.ac.in

* **Student Email:** `student23.bce@vitbhopal.ac.in’
* **Teacher Email:** `teacher1@vitbhopal.ac.in`
