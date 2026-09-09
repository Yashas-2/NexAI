"""NexAI Users – Role Constants"""


class UserRole:
    CHIEF_SUPERINTENDENT = "CHIEF_SUPERINTENDENT"
    HOD = "HOD"
    PAPER_SETTER = "PAPER_SETTER"
    INVIGILATOR = "INVIGILATOR"
    EVALUATOR = "EVALUATOR"
    SCRUTINIZER = "SCRUTINIZER"
    STUDENT = "STUDENT"
    SCANNING_OFFICER = "SCANNING_OFFICER"
    FACULTY = "FACULTY"
    ADMISSION = "ADMISSION"

    CHOICES = [
        (CHIEF_SUPERINTENDENT, "Chief Superintendent / CoE"),
        (HOD, "Head of Department"),
        (PAPER_SETTER, "Question Paper Setter"),
        (INVIGILATOR, "Invigilator"),
        (EVALUATOR, "Faculty Evaluator"),
        (SCRUTINIZER, "Scrutinizer"),
        (STUDENT, "Student"),
        (SCANNING_OFFICER, "Scanning Center Superintendent"),
        (FACULTY, "Faculty / Course Teacher"),
        (ADMISSION, "Admission Officer"),
    ]
