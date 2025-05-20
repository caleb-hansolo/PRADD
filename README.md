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


## How to Use this Application

This web application is used to clean data of raw and realsense depth imagery to match the patterns of images, user-specified thresholds, and an LLM prompt provided by the user. 

### Training and Testing Page

**Left Side:** Menu
* Pipeline Processes Dropdown - select which processes of the machine learning pipeline you would like to be applied to your videos/data
    * **Pattern Thresholding** uses the pattern images you have uploaded in the *Training/Pattern Matching Data pane* to analyze your videos and goes frame-by-frame to see if the realsense video matches the patterns of the images provided
    * **Model Object Detection** uses the LLM prompt you can edit in the *Advanced Settings* page to analyze each frame to see if it matches the prompt you provide
    * **Solid Color Detection** uses a black and white pixel threshold to simplify the values of pixels with color values above or below them as black or white, then uses the solid color detection percentage to discard images that have a certain percentage of their pixels at a solid color (determined by the black and white pixel thresholds)

**Right Side:** Upload Panes
* *Dataset Upload Pane*:
    * Please upload your raw imagery here (MUST be in video form)
* *Mirror Dataset Upload Pane:*
    * Please upload your corresponding realsense depth imagery here (MUST be in video form)
    * This MUST be the exact same length as your raw *Dataset* video, or else the pipeline will not function
* *Training/Pattern Matching Data Pane:*
    * Please upload multiple realsense depth images (PNG, JPG) to train the pattern detection model in the pipeline


      
### Advanced Settings Page

**Left Side:** Menu
* Gives you the ability to edit the threshold values and other criteria that the processes in the pipeline use to detect whether the data from your video is valid
* Five Dropdowns:
    * *Pattern SIFT Distance:* range from 10-500, a lower value here means stricter pattern recognition
    * *Solid Color Detection %:* range from 0.05-0.95, percentage of pixels in the image with values above or below the black or white pixel thresholds that are required to mark an image as "solid color" (these images will be registered invalid by the **Solid Color Detection** process)
    * *Black Pixel Thresholdz:* range from 1-100, color value at which a pixel must be to be considered "BLACK" (a solid color) when running the **Solid Color Detection** process
    * *White Pixel Thresholdz:* range from 150-255, color value at which a pixel must be to be considered "WHITE" (a solid color) when running the **Solid Color Detection** process
    * *Object Detection Prompt:* Prompt used by Ollama 34b LLM to analyze each frame to see if the frame meets the criteria specified in the prompt (used in the **Model Object Detection** process)
* *Restor Defaults* Button: this will restore the default values of each pipeline variable in the advanced settings page

**Right Side:** Upload Panes
* Same functionality as in the Training and Testing Page!!



### Metrics Page

No current functionality
