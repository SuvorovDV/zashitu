def enqueue_generation(order_id: str):
    from generation.tasks import generate_presentation_task
    generate_presentation_task.delay(order_id)
