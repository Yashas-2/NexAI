import 'package:nexai_invigilator/models/exam_models.dart';
import 'package:nexai_invigilator/core/network/api_client.dart';

class InvigilatorRepository {
  final ApiClient _apiClient = ApiClient();
  
  Future<InvigilatorSession> activateSession(String sessionKey) async {
    final response = await _apiClient.post('/invigilator-keys/activate/', {
      'session_key': sessionKey
    });

    final studentsList = (response['students'] as List<dynamic>? ?? []).map((s) {
      return StudentDeskItem(
        deskId: s['deskId'] ?? '',
        usn: s['usn'] ?? '',
        studentName: s['studentName'] ?? '',
        courseCode: s['courseCode'] ?? '',
        seatPosition: s['seatPosition'] ?? '',
        isQrVerified: s['isQrVerified'] ?? false,
        isBiometricMatched: s['isBiometricMatched'] ?? false,
        status: _parseStatus(s['status']),
        bookletBarcode: s['bookletBarcode'],
        dummyBarcode: s['dummyBarcode'],
        avatarInitials: s['avatarInitials'],
        digitizedPagesCount: s['digitizedPagesCount'],
      );
    }).toList();

    final incidentsList = (response['incidents'] as List<dynamic>? ?? []).map((i) {
      return IncidentReportItem(
        id: i['id'] ?? '',
        deskId: i['deskId'] ?? '',
        studentUsn: i['studentUsn'] ?? '',
        studentName: i['studentName'] ?? '',
        infractionType: i['infractionType'] ?? '',
        description: i['description'] ?? '',
        timestamp: i['timestamp'] ?? '',
        isBroadcastedToCoE: i['isBroadcastedToCoE'] ?? true,
      );
    }).toList();

    return InvigilatorSession(
      sessionId: response['sessionId'] ?? sessionKey,
      hallNumber: response['hallNumber'] ?? '',
      courseCode: response['courseCode'] ?? '',
      courseTitle: response['courseTitle'] ?? '',
      examDate: response['examDate'] ?? '',
      timeSlot: response['timeSlot'] ?? '',
      chiefInvigilatorName: response['chiefInvigilatorName'] ?? '',
      students: studentsList,
      incidents: incidentsList,
    );
  }

  Future<bool> markAttendance(String sessionKey, String usn) async {
    try {
      final response = await _apiClient.post('/invigilator/mark-attendance/', {
        'session_key': sessionKey,
        'usn': usn,
      });
      return response['status'] == 'PRESENT';
    } catch (e) {
      if (e is Exception) {
        final message = e.toString().replaceFirst('Exception: ', '');
        throw Exception(message);
      }
      throw Exception('Failed to mark attendance');
    }
  }

  StudentAttendanceStatus _parseStatus(String? statusStr) {
    if (statusStr == null) return StudentAttendanceStatus.unverified;
    switch (statusStr.toLowerCase()) {
      case 'present': return StudentAttendanceStatus.present;
      case 'absent': return StudentAttendanceStatus.absent;
      case 'malpractice': return StudentAttendanceStatus.malpractice;
      default: return StudentAttendanceStatus.unverified;
    }
  }
}
