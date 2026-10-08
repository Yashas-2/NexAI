enum StudentAttendanceStatus {
  present,
  absent,
  malpractice,
  unverified,
}

class StudentDeskItem {
  final String deskId; // e.g. "Desk B-01"
  final String usn;
  final String studentName;
  final String courseCode;
  final String seatPosition; // "Row 1, Col 1"
  final bool isQrVerified;
  final bool isBiometricMatched;
  final StudentAttendanceStatus status;
  final String? bookletBarcode;
  final String? dummyBarcode;
  final String? avatarInitials;
  final int? digitizedPagesCount;

  StudentDeskItem({
    required this.deskId,
    required this.usn,
    required this.studentName,
    required this.courseCode,
    required this.seatPosition,
    this.isQrVerified = false,
    this.isBiometricMatched = false,
    this.status = StudentAttendanceStatus.unverified,
    this.bookletBarcode,
    this.dummyBarcode,
    this.avatarInitials,
    this.digitizedPagesCount,
  });

  StudentDeskItem copyWith({
    bool? isQrVerified,
    bool? isBiometricMatched,
    StudentAttendanceStatus? status,
    String? bookletBarcode,
    String? dummyBarcode,
    int? digitizedPagesCount,
  }) {
    return StudentDeskItem(
      deskId: deskId,
      usn: usn,
      studentName: studentName,
      courseCode: courseCode,
      seatPosition: seatPosition,
      isQrVerified: isQrVerified ?? this.isQrVerified,
      isBiometricMatched: isBiometricMatched ?? this.isBiometricMatched,
      status: status ?? this.status,
      bookletBarcode: bookletBarcode ?? this.bookletBarcode,
      dummyBarcode: dummyBarcode ?? this.dummyBarcode,
      digitizedPagesCount: digitizedPagesCount ?? this.digitizedPagesCount,
      avatarInitials: avatarInitials,
    );
  }
}

class IncidentReportItem {
  final String id;
  final String deskId;
  final String studentUsn;
  final String studentName;
  final String infractionType; // "Unauthorized Notes", "Mobile Phone", "Impersonation", "Disruptive Behavior"
  final String description;
  final String timestamp;
  final bool isBroadcastedToCoE;

  IncidentReportItem({
    required this.id,
    required this.deskId,
    required this.studentUsn,
    required this.studentName,
    required this.infractionType,
    required this.description,
    required this.timestamp,
    this.isBroadcastedToCoE = true,
  });
}

class InvigilatorSession {
  final String sessionId;
  final String? examSessionId;
  final String? examSessionName;
  final String hallNumber; // e.g. "Exam Hall B-104"
  final String courseCode; // e.g. "CS201"
  final String courseTitle; // e.g. "Data Structures & Algorithms"
  final String examDate;
  final String timeSlot;
  final String chiefInvigilatorName;
  final String dutyRole;
  final List<StudentDeskItem> students;
  final List<IncidentReportItem> incidents;

  InvigilatorSession({
    required this.sessionId,
    this.examSessionId,
    this.examSessionName,
    required this.hallNumber,
    required this.courseCode,
    required this.courseTitle,
    required this.examDate,
    required this.timeSlot,
    required this.chiefInvigilatorName,
    this.dutyRole = '',
    required this.students,
    required this.incidents,
  });

  InvigilatorSession copyWith({
    List<StudentDeskItem>? students,
    List<IncidentReportItem>? incidents,
  }) {
    return InvigilatorSession(
      sessionId: sessionId,
      examSessionId: examSessionId,
      examSessionName: examSessionName,
      hallNumber: hallNumber,
      courseCode: courseCode,
      courseTitle: courseTitle,
      examDate: examDate,
      timeSlot: timeSlot,
      chiefInvigilatorName: chiefInvigilatorName,
      dutyRole: dutyRole,
      students: students ?? this.students,
      incidents: incidents ?? this.incidents,
    );
  }

  int get totalCount => students.length;
  int get presentCount => students.where((s) => s.status == StudentAttendanceStatus.present).length;
  int get absentCount => students.where((s) => s.status == StudentAttendanceStatus.absent).length;
  int get malpracticeCount => students.where((s) => s.status == StudentAttendanceStatus.malpractice).length;
  int get unverifiedCount => students.where((s) => s.status == StudentAttendanceStatus.unverified).length;
  int get bookletsIngestedCount => students.where((s) => s.bookletBarcode != null).length;
}

/// Outcome of a backend attendance mark (real API response).
class AttendanceResult {
  final bool success;
  final bool alreadyMarked;
  final String status; // PRESENT / ABSENT / MALPRACTICE
  final String seat;
  final String message;

  const AttendanceResult({
    required this.success,
    this.alreadyMarked = false,
    this.status = '',
    this.seat = '',
    this.message = '',
  });
}
