import ollama
import cv2
import numpy as np
import re
import os
import zipfile
import io
import shutil
import time

PATTERN_DIR = "Pattern_images/depth"  # Directory containing pattern images
PATTERN_IMAGES = []
PATTERN_NAMES = []

THRESHOLD_BLACK_WHITE = 0.60  # Threshold for black or white percentage
THRESHOLD_PATTERN_MATCH = 200  # Threshold for pattern matching


def is_mostly_black_or_white(image, threshold=THRESHOLD_BLACK_WHITE):
    """
    Check if an image is mostly black or white.

    Args:
        image (str): Path to the image to be checked
        threshold (float): Threshold for black or white percentage

    Returns:
        bool: True if the image is mostly black or white, False otherwise

    """
    if len(image.shape) == 3:
        image = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    total_pixels = image.size

    black_threshold = 30
    white_threshold = 225

    black_pixels = np.sum(image <= black_threshold)
    white_pixels = np.sum(image >= white_threshold)

    black_percentage = black_pixels / total_pixels
    white_percentage = white_pixels / total_pixels

    return black_percentage >= threshold or white_percentage >= threshold

def modelObjectDetection(frame):
    """
    Detect man-made objects in an image using a pre-trained model fro Ollama.

    Args:
        frame (str): Path to the image to be checked

    Returns:
        bool : True if there is a man-made object in the image, False otherwise

    """

    objects_detected = True #True if man-made objects are detected, False if natural objects are detected

    _, buffer = cv2.imencode('.jpg', frame)
    image_bytes = buffer.tobytes()

    res = ollama.chat(
        model="llava:34b",
        messages=[
            {
                'role': 'user',
                'content': "Analyze the image and determine with at least 70% confidence whether it contains man-made objects (buildings, houses, light poles, cars, sheds, or artificial structures) that affect depth; exclude natural elements like trees or paths in mostly tree-covered images, and explicitly state 'True' or 'False' before listing identified objects or explaining uncertainty.",
                'images': [image_bytes]  # Pass bytes instead of a NumPy array
            }
        ]
    )


    if re.search(r'False', res['message']['content']):
        objects_detected = False

    return objects_detected, res['message']['content']


def patternThresholding(test_image):
    """
    Compare an image against multiple patterns using SIFT features and return the best match.

    Args:
        test_image (Ndarray): image to be matched
        pattern_imgs (list): List of pattern image arrays
        pattern_names (list): List of pattern image names

    Returns:
        tuple: (best_matching_pattern_name, best_matching_pattern_img, number_of_good_matches)
    """
    Threshold = THRESHOLD_PATTERN_MATCH  # You can adjust this threshold

    # Initialize SIFT detector
    sift = cv2.SIFT_create()

    # Load and process test image
    test_img = test_image


    if test_img is None:
        raise ValueError(f"Could not load test image: {test_image}")

    # Get keypoints and descriptors for test image
    test_keypoints, test_descriptors = sift.detectAndCompute(test_img, None)

    # Initialize matcher
    bf = cv2.BFMatcher(cv2.NORM_L2, crossCheck=True)

    best_match_img = None
    best_match_name = None
    best_match_count = 0

    # Compare with each pattern
    for pattern_img, pattern_name in zip(PATTERN_IMAGES, PATTERN_NAMES):
        if pattern_img is None:
            print(f"Warning: Could not load pattern: {pattern_name}")
            continue

        if len(pattern_img.shape) == 3:
            pattern_img_gray = cv2.cvtColor(pattern_img, cv2.COLOR_BGR2GRAY)
        else:
            pattern_img_gray = pattern_img

        # Get keypoints and descriptors for pattern
        pattern_keypoints, pattern_descriptors = sift.detectAndCompute(pattern_img_gray, None)

        if pattern_descriptors is None or test_descriptors is None:
            continue

        # Match descriptors
        matches = bf.match(test_descriptors, pattern_descriptors)

        matches = sorted(matches, key=lambda x: x.distance)

        # Count good matches (you can adjust the threshold)
        good_matches = [m for m in matches if m.distance < Threshold]
        num_good_matches = len(good_matches)

        # Update best match if this pattern has more good matches
        if num_good_matches > best_match_count:
            best_match_count = num_good_matches
            best_match_img = pattern_img
            best_match_name = pattern_name

    return best_match_name

def sort_into_folders(root_folder,name_folder, raw_image,raw_image_name, realsense_image, realsense_image_name):
    """
    Sort images into folders based on the name of the pattern.

    Args:
        root_folder (str): Path to the root folder
        name_folder (str): Name of the folder to be created
        raw_image (numpy array): Raw image
        raw_image_name (str): Name of the raw image
        realsense_image (numpy array): Realsense image
        realsense_image_name (str): Name of the realsense image


    """


    if not os.path.exists(os.path.join(root_folder, name_folder, "raw")):
        os.makedirs(os.path.join(root_folder, name_folder, "raw"))

    if not os.path.exists(os.path.join(root_folder, name_folder, "realsense")):
        os.makedirs(os.path.join(root_folder, name_folder, "realsense"))

    cv2.imwrite(os.path.join(root_folder, name_folder, "raw", raw_image_name), raw_image)
    cv2.imwrite(os.path.join(root_folder, name_folder, "realsense", realsense_image_name), realsense_image)


def create_text_file_with_removed_images(root_folder, removed_images):
    """
    Create a text file with the names of the removed images in the root folder.

    Args:
        root_folder (str): Path to the root folder
        removed_images_raw (list): List of removed raw images
        removed_images_realsense (list): List of removed realsense images

    """
    with open(os.path.join(root_folder, "removed_images.txt"), "w") as f:
        f.write("Images removed because they are mostly black or white or contain natural objects\n")
        for file_name, reason in removed_images:
            f.write(f"frame image: {file_name}, Reason: {reason}\n")
        f.close()

def create_zip_from_directory(directory_path, zip_filename="Results.zip"):
    """
    Create a zip file from a directory.

    Args:
        directory_path (str): Path to the directory to be zipped
        zip_filename (str): Name of the zip file
    """

    memory_zip = io.BytesIO()

    # Create zip file in memory
    with zipfile.ZipFile(memory_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(directory_path):
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, directory_path)
                zipf.write(file_path, arcname)


    memory_zip.seek(0)
    script_dir = os.getcwd()
    zip_path = os.path.join(script_dir, zip_filename)

    with open(zip_path, "wb") as f:
        f.write(memory_zip.getvalue())

    print(f"ZIP file created at: {zip_path}")

    return zip_path




def load_images(raw_image,raw_image_name, realsense_image, realsense_image_name, dir_pattern = PATTERN_DIR):
    """
    Load images from the specified directories and process them.

    Args:
        raw_image (numpy): the raw image
        raw_image_name (str): Name of the raw image
        realsense_image (numpy array): the realsense image
        realsense_image_name (str): Name of the realsense image
        dir_pattern (str): Path to the directory containing pattern images

    """
    if not is_mostly_black_or_white(realsense_image):
        object_detected, reason = modelObjectDetection(raw_image)
        if not object_detected:
            name = patternThresholding(realsense_image)
            print("Accepted_images", name, raw_image_name)
            sort_into_folders("Accepted_images", name, raw_image, raw_image_name, realsense_image, realsense_image_name)
            return True, name
        else:
            print(reason)
            return False, reason

    else:
        print("Image is mostly black or white")
        return False, "Image is mostly black or white"


def videos_to_frames(path_to_raw_video, path_to_realsense_video):
    """
    Extract frames from two videos and process them.

    Args:
        path_to_video_one (str): Path to the first video
        path_to_video_two (str): Path to the second video
    """
    remove_images = []
    global PATTERN_IMAGES, PATTERN_NAMES, PATTERN_DIR
    for f in os.listdir(PATTERN_DIR):
        if f.endswith('.png'):
            img = cv2.imread(os.path.join(PATTERN_DIR, f))
            if img is not None:
                PATTERN_IMAGES.append(img)
                PATTERN_NAMES.append(f)

    root_folder = "Accepted_images"
    if not os.path.exists(root_folder):
        os.makedirs(root_folder)
    else:
        shutil.rmtree(root_folder) #remove the folder and its contents and create a new one
        os.makedirs(root_folder)

    cap_raw_video = cv2.VideoCapture(path_to_raw_video)
    cap_realsense_video = cv2.VideoCapture(path_to_realsense_video)
    
    if not cap_raw_video.isOpened() or not cap_realsense_video.isOpened():
        print("Error: Unable to open video.")

    frame_count = 0

    while True:
        ret1, frame1 = cap_raw_video.read() #raw frame
        ret2, frame2 = cap_realsense_video.read() #realsense frame
        #once on of the videos reaches the end, break the loop
        if not ret1 or not ret2:
            break

        frame_filename1 = f"frame_{frame_count:05d}.jpg"
        frame_filename2 = f"frame_{frame_count:05d}.jpg"


        is_it_a_good_image, reason = load_images(frame1, frame_filename1, frame2, frame_filename2)
        if not is_it_a_good_image:
            remove_images.append((frame_filename1, reason))

        frame_count += 1

    cap_raw_video.release()
    cap_realsense_video.release()

    create_text_file_with_removed_images("Accepted_images", remove_images)

    return frame_count

#edit so it gets passed the path to the video
def main():
    start = time.time()
    realsense_video_path = "videos/realsense_006.mp4"
    raw_video_path = "videos/raw_006.mp4"

    frame_count = videos_to_frames(raw_video_path, realsense_video_path)

    print(f"Processed {frame_count} frames")

    zip_dir = "Accepted_images"
    zip_file = create_zip_from_directory(zip_dir)

    end = time.time()
    print(end - start)
    print("Pipeline completed successfully!")
    print("You can download the output zip file from the following link:", zip_file)


if __name__ == "__main__":
    main()