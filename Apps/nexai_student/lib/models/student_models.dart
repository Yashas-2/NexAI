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
  final String eligibilityStatus; // "ELIGIBLE", "PENDING", "NOT ELIGIBLE"
  final bool isCompleted;
  final String qrPayload;
  final String? questionPaperId;
  final String? slotId;
  final String? sessionName;
  final bool isCie; // false = Semester End Examination (SEE)
  final bool attemptCompleted;
  final DateTime? attemptSubmittedAt;
  final bool isLocked;
  final String? attemptId;
  final bool examEnded;

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
    this.slotId,
    this.sessionName,
    this.isCie = true,
    this.attemptCompleted = false,
    this.attemptSubmittedAt,
    this.isLocked = false,
    this.attemptId,
    this.examEnded = false,
  });

  /// Whether the exam can be started (eligible, not completed, not ended)
  bool get canStartExam => 
      eligibilityStatus == 'ELIGIBLE' && 
      !attemptCompleted && 
      !isLocked && 
      !examEnded;

  /// Status text to display instead of "Ready to Start"
  String get statusText {
    if (!canStartExam) {
      if (attemptCompleted || isLocked) return 'Exam Completed';
      if (examEnded) return 'Exam Ended';
      if (eligibilityStatus == 'NOT ELIGIBLE') return 'Not Eligible';
      if (eligibilityStatus == 'PENDING') return 'Eligibility Pending';
    }
    return 'Ready to Start';
  }

  /// Button text based on status
  String get buttonText {
    if (attemptCompleted || isLocked) return 'Exam Completed';
    if (examEnded) return 'Exam Ended';
    if (eligibilityStatus == 'NOT ELIGIBLE') return 'Not Eligible';
    if (eligibilityStatus == 'PENDING') return 'Eligibility Pending';
    return 'Verify Face & Enter Proctor Mode 🔒';
  }

  /// Whether the start button should be enabled
  bool get isButtonEnabled => canStartExam;
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
  /// Sub-question marker ('a', 'b', …) — null for whole questions.
  final String? part;
  /// Paper section, e.g. 'Part A'.
  final String? section;
  final String questionText;
  final int maxMarks;
  final String type; // "MCQ", "CODE", "THEORY"
  final List<String>? options;
  String? candidateAnswer;
  String? answerImageBase64;
  bool isAnswered;
  int currentPageNumber;
  int totalPages;

  ExamQuestionItem({
    required this.questionNumber,
    this.part,
    this.section,
    required this.questionText,
    required this.maxMarks,
    required this.type,
    this.options,
    this.candidateAnswer,
    this.answerImageBase64,
    this.isAnswered = false,
    this.currentPageNumber = 1,
    this.totalPages = 1,
  });

  /// Full display label: "Q1(a)" or "Q1".
  String get label =>
      (part != null && part!.isNotEmpty) ? 'Q$questionNumber($part)' : 'Q$questionNumber';

  /// Compact navigation-tab label: "1a" or "1".
  String get tabLabel =>
      (part != null && part!.isNotEmpty) ? '$questionNumber$part' : '$questionNumber';
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
