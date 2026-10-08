import 'dart:convert';

import 'package:nexai_invigilator/models/exam_models.dart';
import 'package:nexai_invigilator/core/network/api_client.dart';

class InvigilatorRepository {
  final ApiClient _apiClient = ApiClient();

  /// Extracts the backend `{"error": "..."}` message from an ApiClient throw.
  static String extractApiError(Object error) {
    final raw = error.toString().replaceFirst('Exception: ', '');
    try {
      if (raw.startsWith('API Error')) {
        final idx = raw.indexOf(' - ');
        if (idx != -1) {
          final decoded = jsonDecode(raw.substring(idx + 3));
          if (decoded is Map && decoded['error'] != null) {
            return decoded['error'].toString();
          }
        }
      }
    } catch (_) {}
    return raw;
  }

  Future<InvigilatorSession> activateSession(String sessionKey) async {
    final response = await _apiClient.post('/invigilator-keys/activate/', {
      'session_key': sessionKey,
    });
    return _parseSession(response, sessionKey);
  }

  InvigilatorSession _parseSession(Map<String, dynamic> response, String fallbackKey) {
    final students = (response['students'] as List<dynamic>? ?? []).map((s) {
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
        digitizedPagesCount: s['digitizedPagesCount'] is int
            ? s['digitizedPagesCount']
            : int.tryParse('${s['digitizedPagesCount'] ?? 0}') ?? 0,
      );
    }).toList();

    final incidents = (response['incidents'] as List<dynamic>? ?? []).map((i) {
      return IncidentReportItem(
        id: i['id'] ?? '',
        deskId: i['deskId'] ?? '',
        studentUsn: i['studentUsn'] ?? '',
        studentName: i['studentName'] ?? '',
        infractionType: i['infractionType'] ?? '',
        description: i['description'] ?? '',
        timestamp: i['timestamp'] ?? '',
        isBroadcastedToCoE: i['isBroadcastedToCoe'] ?? true,
      );
    }).toList();

    return InvigilatorSession(
      sessionId: response['sessionId'] ?? fallbackKey,
      examSessionId: response['exam_session_id'],
      examSessionName: response['examSessionName'],
      hallNumber: response['hallNumber'] ?? '',
      courseCode: response['courseCode'] ?? '',
      courseTitle: response['courseTitle'] ?? '',
      examDate: response['examDate'] ?? '',
      timeSlot: response['timeSlot'] ?? '',
      chiefInvigilatorName: response['chiefInvigilatorName'] ?? '',
      dutyRole: response['dutyRole'] ?? '',
      students: students,
      incidents: incidents,
    );
  }

  /// Marks attendance via the backend (validates hall-ticket QR payload,
  /// seat allocation and duplicate scans server-side).
  Future<AttendanceResult> markAttendance(
    String sessionKey,
    String usn, {
    String? qrPayload,
    String status = 'present',
  }) async {
    final body = <String, dynamic>{
      'session_key': sessionKey,
      'usn': usn,
      'status': status,
    };
    if (qrPayload != null && qrPayload.isNotEmpty) {
      body['qr_payload'] = qrPayload;
    }
    try {
      final response = await _apiClient.post('/invigilator/mark-attendance/', body);
      return AttendanceResult(
        success: true,
        alreadyMarked: response['already_marked'] == true,
        status: '${response['status'] ?? ''}',
        seat: '${response['seat'] ?? ''}',
        message: '${response['message'] ?? ''}',
      );
    } catch (e) {
      return AttendanceResult(success: false, message: extractApiError(e));
    }
  }

  /// Persists a malpractice incident + flags the candidate server-side.
  Future<IncidentReportItem> reportIncident(
    String sessionKey,
    String usn,
    String infractionType,
    String description,
  ) async {
    final response = await _apiClient.post('/invigilator/incident/', {
      'session_key': sessionKey,
      'usn': usn,
      'infraction_type': infractionType,
      'description': description,
    });
    return IncidentReportItem(
      id: response['id'] ?? '',
      deskId: response['deskId'] ?? '',
      studentUsn: response['studentUsn'] ?? '',
      studentName: response['studentName'] ?? '',
      infractionType: response['infractionType'] ?? '',
      description: response['description'] ?? '',
      timestamp: response['timestamp'] ?? '',
      isBroadcastedToCoE: response['isBroadcastedToCoe'] ?? true,
    );
  }

  /// Tags a collected answer booklet onto the candidate's attendance record.
  Future<Map<String, dynamic>> ingestBooklet(
    String sessionKey,
    String usn,
    String bookletBarcode,
    String dummyBarcode,
  ) async {
    final response = await _apiClient.post('/invigilator/booklet/', {
      'session_key': sessionKey,
      'usn': usn,
      'booklet_barcode': bookletBarcode,
      'dummy_barcode': dummyBarcode,
    });
    return Map<String, dynamic>.from(response);
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
