class StudentProfile {
  final String usn;
  final String fullName;
  final String program;
  final String semester;
  final String section;
  final double cgpa;
  final double latestSgpa;
  final String avatarInitials;

  StudentProfile({
    required this.usn,
    required this.fullName,
    required this.program,
    required this.semester,
    required this.section,
    required this.cgpa,
    required this.latestSgpa,
    required this.avatarInitials,
  });
}

class ExamScheduleItem {
  final String courseCode;
  final String courseTitle;
  final String examDate;
  final String timeSlot;
  final String hallNumber;
  final String deskNumber;
  final String eligibilityStatus; // "ELIGIBLE", "CONDONATION_REQUIRED"
  final bool isCompleted;
  final String qrPayload;
  final String? questionPaperId;

  ExamScheduleItem({
    required this.courseCode,
    required this.courseTitle,
    required this.examDate,
    required this.timeSlot,
    required this.hallNumber,
    required this.deskNumber,
    required this.eligibilityStatus,
    this.isCompleted = false,
    required this.qrPayload,
    this.questionPaperId,
  });
}

class ExamResultItem {
  final String courseCode;
  final String courseTitle;
  final int credits;
  final String gradeLetter; // "S", "A", "B", "C", "D", "F"
  final int cieMarks;
  final int seeMarks;
  final int totalMarks;
  final int scriptPagesCount;
  final bool isRevaluationApplied;

  ExamResultItem({
    required this.courseCode,
    required this.courseTitle,
    required this.credits,
    required this.gradeLetter,
    required this.cieMarks,
    required this.seeMarks,
    required this.totalMarks,
    required this.scriptPagesCount,
    this.isRevaluationApplied = false,
  });

  ExamResultItem copyWith({
    bool? isRevaluationApplied,
  }) {
    return ExamResultItem(
      courseCode: courseCode,
      courseTitle: courseTitle,
      credits: credits,
      gradeLetter: gradeLetter,
      cieMarks: cieMarks,
      seeMarks: seeMarks,
      totalMarks: totalMarks,
      scriptPagesCount: scriptPagesCount,
      isRevaluationApplied: isRevaluationApplied ?? this.isRevaluationApplied,
    );
  }
}

class ExamQuestionItem {
  final int questionNumber;
  final String questionText;
  final int maxMarks;
  final String type; // "MCQ", "CODE", "THEORY"
  final List<String>? options;
  String? candidateAnswer;
  bool isAnswered;

  ExamQuestionItem({
    required this.questionNumber,
    required this.questionText,
    required this.maxMarks,
    required this.type,
    this.options,
    this.candidateAnswer,
    this.isAnswered = false,
  });
}

class CourseAttendanceCieItem {
  final String courseCode;
  final String courseTitle;
  final String facultyName;
  final int credits;
  final int attendedClasses;
  final int totalClasses;
  final double cie1Marks; // max 20
  final double cie2Marks; // max 20
  final double cie3Marks; // max 20
  final double assignmentMarks; // max 10
  final double totalCieMarks; // max 50

  CourseAttendanceCieItem({
    required this.courseCode,
    required this.courseTitle,
    required this.facultyName,
    required this.credits,
    required this.attendedClasses,
    required this.totalClasses,
    required this.cie1Marks,
    required this.cie2Marks,
    required this.cie3Marks,
    required this.assignmentMarks,
    required this.totalCieMarks,
  });

  double get attendancePercentage => totalClasses > 0 ? (attendedClasses / totalClasses) * 100 : 0.0;
  bool get isAttendanceEligible => attendancePercentage >= 75.0;
  bool get isCiePassing => totalCieMarks >= 20.0;
}
