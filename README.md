# PRADD - Pattern Recognition Application for Depth Data

## For Deploying Locally (Development and Testing)

1. Navigate to the `app` directory. within that, navigate to the `server` directory.
2. Create a virtual environment.
   ```shell
     python -m venv venv
     ```
   * If on Windows, run this command:
     ```shell
     .\venv\Scripts\activate
     ```
   * If on Mac or Linux, run this command:
     ```shell
     source venv/bin/activate
     ```
3. Once the virtual environment is activated, install necessary libraries
   ```shell
   pip install -r requirements.txt
   ```
4. Create .env file in the `server` directory

   Example server .env file for local deployment:
   ```env
   BACKEND_HOST=127.0.0.1
   BACKEND_PORT=5000
   FRONTEND_ORIGIN=http://localhost:3000
   ```
6. [Download Ollama](https://ollama.com/download)
7. In a separate terminal, download and run [Ollama 34b](https://ollama.com/library/llava:34b)
   ```shell
   ollama run llava:34b
   ```
8. Start the backend
   ```shell
   python main.py
   ```
9. In a separate terminal, navigate to the `app/client/` directory
10. Install necessary packages with
    ```shell
    npm install
    ```
11. Create .env file in the `client` directory

    Example client .env file for local deployment:
    ```env
    REACT_APP_API_BASE_URL=http://localhost:5000/api
    REACT_APP_BASE_URL=http://localhost:5000
    ```
12. Run the React App
    ```shell
    npm start
    ```
     
