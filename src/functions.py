import re
import random
import string

char_greek = 'αβγδεζηθικλμνξοπρστυφχψω'
char_cyrilic = 'абвгдежзийклмнопрстуфхцчшщъыьэюя'
permissible_characters = char_greek + char_cyrilic

# Dictionary with validation patterns
patterns = {
    "email": r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}$",
    "date": r"^\d{4}-[0-1][0-9]-[0-2][0-9]$",
    "username": r"[A-Za-z_一-龠ぁ-ゔァ-ヴー]*[A-Za-z0-9_\s一-龠ぁ-ゔァ-ヴー\-]+$",
    "password": r"^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*\W)(?!.* ).{8,128}$",
    "alphabet": r"^[A-Za-z\s]*$"
}

def validate_string(type_, string_):
    if type_ == "string":
        return bool(string_)
    if type_ == "username":
        return bool(string_ and not string_.isspace() and re.match(patterns["username"], string_))
    return bool(re.match(patterns.get(type_, ""), string_))


def generate_random_key(length=64):
    letters_and_digits = string.ascii_letters + string.digits
    return ''.join(random.choice(letters_and_digits) for i in range(length))