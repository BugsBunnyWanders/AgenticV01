from google import genai
from google.genai import types
from PIL import Image
from io import BytesIO
import base64
import os

# load the Gemini API key from the environment variable .env
from dotenv import load_dotenv
load_dotenv()




client = genai.Client()

def create_image(text_input: str, image_file_name: str) -> dict:
  """
  Genrates an image based on the text input and saves it to the assets/images folder.
  
  Args:
    text_input (str): The text prompt to generate an image using gemini image generation model.
    image_file_name (str): The name of the image file to save.
  
  Returns:
    dict: A dictionary containing the text and image file path.
  """
  contents = [text_input]
  image_file_path = f'assets/images/{image_file_name}'
  image = None
  if os.path.exists(image_file_path):
    image = Image.open(image_file_path)
    contents.append(image)

  response = client.models.generate_content(
      model="gemini-2.0-flash-preview-image-generation",
      contents=contents,
      config=types.GenerateContentConfig(
        response_modalities=['TEXT', 'IMAGE']
      )
  )
  
  resultDict = {}

  for part in response.candidates[0].content.parts:
    if part.text is not None:
      print(part.text)
      resultDict['text'] = part.text
    elif part.inline_data is not None:
      image = Image.open(BytesIO((part.inline_data.data)))
      image.save(image_file_path)
      resultDict['image'] = image_file_path
      # image.show()
  resultDict['status'] = 'success'
  return resultDict


# create_image('Hi, generate a 3d picture of iron man ', 'iron-man.png')