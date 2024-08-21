from tensorflow.keras.models import load_model
import numpy as np
from tensorflow.keras.preprocessing import image
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def conv_label(label):
    font_dict = {
        0: 'Agency',
        1: 'Akzidenz Grotesk',
        2: 'Algerian',
        3: 'Arial',
        4: 'Baskerville',
        5: 'Bell MT',
        6: 'Bembo',
        7: 'Bodoni',
        8: 'Book Antiqua',
        9: 'Brandish',
        10: 'Calibry',
        11: 'Californian FB',
        12: 'Calligraphy',
        13: 'Calvin',
        14: 'Cambria',
        15: 'Candara',
        16: 'Century',
        17: 'Comic Sans MS',
        18: 'Consolas',
        19: 'Corbel',
        20: 'Courier',
        21: 'Didot',
        22: 'Elephant',
        23: 'Fascinate',
        24: 'Franklin Gothic',
        25: 'Futigre',
        26: 'Futura',
        27: 'Garamond',
        28: 'Georgia',
        29: 'Gill Sans',
        30: 'Helvetica',
        31: 'Hombre',
        32: 'Lato',
        33: 'LCD Mono',
        34: 'Lucida Bright',
        35: 'Monotype Corsiva',
        36: 'Mrs Eaves',
        37: 'Myriad',
        38: 'Nasalization',
        39: 'News Gothic',
        40: 'Palatino linotype',
        41: 'Perpetua',
        42: 'Rockwell',
        43: 'Sabon',
        44: 'Snowdrift Regular',
        45: 'Steppes',
        46: 'Times New Roman',
        47: 'Verdana'
    }
    return font_dict.get(label)

# Load the trained model
model_path = sys.argv[2]
model = load_model(model_path)

# Load the image path from arguments
img_path = sys.argv[1]

# Define the target image size (height and width) expected by the model
img_height, img_width = 64, 64  # The size expected by your model

# Load the image and resize it to the input size of the model
img = image.load_img(img_path, target_size=(img_height, img_width))

# Convert the image to a numpy array and normalize its pixel values
x = image.img_to_array(img)
x = x / 255.0

# Add an extra dimension to the array to match the input shape of the model
x = np.expand_dims(x, axis=0)

# Use the trained model to predict the class probabilities for the image
preds = model.predict(x)

# Get the predicted class index with the highest probability
pred_class = np.argmax(preds[0])

# Convert the class index to the font name
font_style = conv_label(pred_class)

print(font_style)
