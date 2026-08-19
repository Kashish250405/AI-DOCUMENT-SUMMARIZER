# AI Document Summarizer

An AI-powered web application that generates concise summaries from **Text, PDF documents, and YouTube videos**.

The application provides a simple and user-friendly interface where users can choose an input type and generate an AI-based summary.

## Features

* Summarize plain text
* Upload and summarize PDF documents
* Summarize YouTube video content
* Simple and responsive user interface
* AI-powered summarization
* React frontend
* Flask backend
* REST API integration

## Technologies Used

### Frontend

* React.js
* Axios
* CSS

### Backend

* Python
* Flask
* Flask-CORS
* OpenAI API
* PyPDF / PyMuPDF
* YouTube Transcript API
* Python Dotenv

## Project Structure

```text
AI-DOCUMENT-SUMMARIZER
│
├── Backend
│   ├── app.py
│   ├── .env
│   └── requirements.txt
│
└── frontend
    ├── src
    │   ├── App.js
    │   └── App.css
    │
    ├── package.json
    └── public
```

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/Kashish250405/AI-DOCUMENT-SUMMARIZER.git
```

Navigate to the project:

```bash
cd AI-DOCUMENT-SUMMARIZER
```

## Backend Setup

Navigate to the backend folder:

```bash
cd Backend
```

Create a virtual environment:

```bash
python -m venv env
```

Activate the virtual environment on Windows PowerShell:

```powershell
.\env\Scripts\Activate.ps1
```

Install the required packages:

```bash
python -m pip install flask flask-cors openai pypdf pymupdf youtube-transcript-api python-dotenv
```

Create a `.env` file and add your API key:

```env
OPENAI_API_KEY=your_api_key_here
```

Start the Flask server:

```bash
python app.py
```

The backend should run on:

```text
http://localhost:5000
```

## Frontend Setup

Open another terminal and navigate to the frontend folder:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Start the React application:

```bash
npm start
```

The frontend will run on:

```text
http://localhost:3000
```

## How It Works

1. Select one of the three modes: **Text, PDF, or YouTube**.
2. Provide the required input.
3. Click the **Summarize** button.
4. The React frontend sends the request to the Flask backend.
5. The backend processes the content and generates a summary.
6. The generated summary is displayed on the screen.

## API Endpoints

### Text Summarization

```text
POST /summarize/text
```

### PDF Summarization

```text
POST /summarize/pdf
```

### YouTube Summarization

```text
POST /summarize/youtube
```

## Future Improvements

* Support for DOCX files
* Multiple summary lengths
* Download summary as PDF
* Copy summary to clipboard
* User authentication
* Summary history
* Improved UI and animations
* Deployment to cloud platforms

## Author

**Kashish**

## Project

AI Document Summarizer – A web application for summarizing Text, PDF documents, and YouTube video content using AI.
