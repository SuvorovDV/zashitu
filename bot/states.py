from aiogram.fsm.state import State, StatesGroup


class FormStates(StatesGroup):
    topic = State()
    direction = State()
    work_type = State()
    duration = State()
    slides_input = State()      # альтернатива duration — ввод кол-ва слайдов
    detail_level = State()
    thesis = State()
    university = State()
    custom_elements = State()   # что обязательно должно быть (или пропустить)
    mode = State()              # 'source_grounded' | 'no_template'
    palette = State()
    tier = State()
    file_upload = State()       # только для source_grounded
    confirm = State()           # финальное подтверждение перед оплатой
    generating = State()
