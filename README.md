# PRaCfID - Pattern Recognition and Cleaning for Image Datasets

## For Deploying Locally (Development and Testing)

1. Navigate to the `app` directory. within that, navigate to the `flask-server` directory.
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
   pip install Flask
   ```
4. Start the backend
   ```shell
   python app.py
   ```
6. In a separate terminal, navigate to the `app/client/` directory
7. Install necessary packages with
   ```shell
   npm install
   ```
8. Run the React App
   ```shell
   npm start
   ```
     
