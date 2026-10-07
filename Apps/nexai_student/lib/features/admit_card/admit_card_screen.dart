import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import '../../core/theme/app_theme.dart';
import '../../services/api_service.dart';

class AdmitCardScreen extends StatefulWidget {
  const AdmitCardScreen({super.key});

  @override
  State<AdmitCardScreen> createState() => _AdmitCardScreenState();
}

class _AdmitCardScreenState extends State<AdmitCardScreen> {
  Map<String, dynamic>? studentProfile;
  List<dynamic> hallTickets = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    try {
      final profileData = await ApiService.get('/student/portal/my_profile/');
      final ticketsData = await ApiService.get('/student/portal/my_hall_tickets/');
      
      setState(() {
        studentProfile = profileData;
        hallTickets = ticketsData is List ? ticketsData : [];
        _isLoading = false;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load admit card: $e'), backgroundColor: Colors.red),
        );
      }
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    final student = studentProfile ?? {};
    final fullName = student['name'] ?? 'Unknown';
    final usn = student['usn'] ?? 'N/A';
    final semester = 'Semester ${student['semester'] ?? '-'}';
    final program = 'B.Tech - ${student['department'] ?? 'CS'}';
    final initials = fullName.split(' ').map((e) => e.isNotEmpty ? e[0] : '').take(2).join('').toUpperCase();

    // Take the most recent hall ticket, if any
    final latestTicket = hallTickets.isNotEmpty ? hallTickets.first : null;
    final slots = latestTicket != null ? (latestTicket['slots'] as List? ?? latestTicket['schedule'] as List? ?? []) : [];
    final activeExam = slots.isNotEmpty ? slots.first : null;
    final qrPayload = usn != 'N/A' ? usn : '';
    final sessionName = latestTicket != null ? (latestTicket['exam_session_name'] ?? '') : '';
    // is_cie is provided by backend; fall back to session name check
    final isCie = latestTicket != null
        ? (latestTicket['is_cie'] == true || sessionName.toUpperCase().contains('CIE'))
        : false;
    final examTypeLabel = isCie ? 'CIE EXAMINATION HALL TICKET' : 'END-SEMESTER EXAM HALL TICKET';
    final ticketNumber = latestTicket != null ? (latestTicket['ticket_number'] ?? '') : '';

    return Scaffold(
      backgroundColor: AppTheme.bgBase,
      appBar: AppBar(
        title: const Text('Digital Hall Ticket'),
        actions: [
          IconButton(
            onPressed: () => _downloadHallTicket(usn, fullName, program, semester, examTypeLabel, qrPayload, slots),
            icon: const Icon(Icons.download_rounded, color: AppTheme.primary),
            tooltip: 'Download PDF',
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.only(left: 20, right: 20, top: 20, bottom: 96),
        child: Column(
          children: [
            // Certified Hall Ticket Card
            Container(
              width: double.infinity,
              decoration: BoxDecoration(
                color: AppTheme.bgSurface,
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: AppTheme.cardBorder, width: 1.5),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.06),
                    blurRadius: 16,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                children: [
                  // Top University Ribbon
                  Container(
                    padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 20),
                    decoration: const BoxDecoration(
                      gradient: LinearGradient(
                        colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'NEXAI AUTONOMOUS UNIVERSITY',
                                style: GoogleFonts.inter(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w900,
                                  fontSize: 11,
                                  letterSpacing: 1,
                                ),
                              ),
                              Text(
                                examTypeLabel,
                                style: const TextStyle(color: Color(0xFF4ADE80), fontWeight: FontWeight.w700, fontSize: 11),
                              ),
                            ],
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: AppTheme.accentGreen.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: AppTheme.accentGreen.withValues(alpha: 0.5)),
                          ),
                          child: const Text('VERIFIED ✓', style: TextStyle(color: Color(0xFF4ADE80), fontWeight: FontWeight.w800, fontSize: 10)),
                        ),
                      ],
                    ),
                  ),

                  Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      children: [
                        // Candidate Bio
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            CircleAvatar(
                              radius: 30,
                              backgroundColor: AppTheme.primary,
                              child: Text(
                                initials,
                                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 20),
                              ),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    fullName,
                                    style: GoogleFonts.inter(fontWeight: FontWeight.w800, fontSize: 16),
                                  ),
                                  Text(
                                    'USN: $usn',
                                    style: const TextStyle(fontWeight: FontWeight.w700, color: AppTheme.accentBlue, fontSize: 13),
                                  ),
                                  Text(
                                    '$program • $semester',
                                    style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),

                        const SizedBox(height: 20),
                        const Divider(height: 1),
                        const SizedBox(height: 20),

                        // High-Density QR Gate Pass
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF8FAFC),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: AppTheme.cardBorder),
                          ),
                          child: Column(
                            children: [
                              if (qrPayload.isNotEmpty) QrImageView(
                                data: qrPayload,
                                version: QrVersions.auto,
                                size: 160.0,
                                eyeStyle: const QrEyeStyle(
                                  eyeShape: QrEyeShape.square,
                                  color: Color(0xFF0F172A),
                                ),
                              ),
                              const SizedBox(height: 8),
                              const Text(
                                'Scan at Gate for Instant Biometric Verification',
                                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppTheme.textSecondary),
                              ),
                            ],
                          ),
                        ),

                        const SizedBox(height: 20),

                        // Designated Seat Radar Card
                          if (activeExam != null) Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: AppTheme.primaryLight,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: AppTheme.primary.withValues(alpha: 0.3)),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    const Icon(Icons.location_on, color: AppTheme.primaryDark, size: 18),
                                    const SizedBox(width: 6),
                                    Text(
                                      isCie ? 'CIE Examination Hall & Seat:' : 'First Allocated Examination Desk:',
                                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12, color: AppTheme.primaryDark),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 10),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(activeExam['room_allocated'] ?? activeExam['room'] ?? 'TBD', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
                                        Text('${activeExam['exam_date'] ?? ''} ${activeExam['exam_time'] ?? ''}', style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary)),
                                      ],
                                    ),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                      decoration: BoxDecoration(
                                        color: AppTheme.primary,
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                      child: Text(
                                        activeExam['desk_number'] ?? activeExam['seat'] ?? 'TBD',
                                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 14),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),

                        const SizedBox(height: 20),

                        // Registered Courses Table
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(isCie ? 'CIE Details & Attendance:' : 'Registered Examination Timetable:', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12)),
                            const SizedBox(height: 10),
                            if (slots.isEmpty) ...[
                              const Text('No exam schedule available yet.', style: TextStyle(color: Colors.red)),
                              const SizedBox(height: 8),
                              Text('Session: ${latestTicket?['exam_session_name'] ?? 'N/A'}', style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary)),
                              if (ticketNumber.isNotEmpty) Text('Ticket: $ticketNumber', style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary)),
                            ],
                            ...slots.map((exam) {
                              return Container(
                                margin: const EdgeInsets.only(bottom: 8),
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: AppTheme.bgBase,
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(color: AppTheme.cardBorder),
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text('${exam['subject_code']}: ${exam['subject_title']}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
                                        if (isCie)
                                          Text('Attendance: ${exam['attendance'] ?? 'N/A'}%', style: const TextStyle(fontSize: 10, color: AppTheme.textSecondary))
                                        else
                                          Text('${exam['exam_date']} • ${exam['exam_time']}', style: const TextStyle(fontSize: 10, color: AppTheme.textSecondary)),
                                      ],
                                    ),
                                    if (isCie)
                                      Text('${exam['cie_marks'] ?? 'N/A'} / 50', style: const TextStyle(fontWeight: FontWeight.w800, color: AppTheme.accentBlue, fontSize: 11))
                                    else
                                      Text(exam['desk_number'] ?? '', style: const TextStyle(fontWeight: FontWeight.w800, color: AppTheme.accentBlue, fontSize: 11)),
                                  ],
                                ),
                              );
                            }),
                          ],
                        ),

                        const SizedBox(height: 20),

                        // Digital Signatures
                        const Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('[DIGITALLY VERIFIED]', style: TextStyle(color: AppTheme.accentGreen, fontSize: 9, fontWeight: FontWeight.w800)),
                                Text('HOD Signature', style: TextStyle(fontSize: 10, color: AppTheme.textSecondary)),
                              ],
                            ),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text('[COE APPROVED]', style: TextStyle(color: AppTheme.accentBlue, fontSize: 9, fontWeight: FontWeight.w800)),
                                Text('Controller of Exams', style: TextStyle(fontSize: 10, color: AppTheme.textSecondary)),
                              ],
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _downloadHallTicket(
    String usn, 
    String fullName, 
    String program, 
    String semester, 
    String examTypeLabel, 
    String qrPayload, 
    List<dynamic> slots
  ) async {
    final pdf = pw.Document();

    pdf.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4,
        build: (pw.Context context) {
          return pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Header(level: 0, child: pw.Text('NEXAI AUTONOMOUS UNIVERSITY')),
              pw.Text(examTypeLabel, style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 18)),
              pw.SizedBox(height: 20),
              pw.Text('Name: $fullName', style: const pw.TextStyle(fontSize: 14)),
              pw.Text('USN: $usn', style: const pw.TextStyle(fontSize: 14)),
              pw.Text('Program: $program', style: const pw.TextStyle(fontSize: 14)),
              pw.Text('Semester: $semester', style: const pw.TextStyle(fontSize: 14)),
              pw.SizedBox(height: 30),
              pw.Text('Scheduled Exams:', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 16)),
              pw.SizedBox(height: 10),
              ...slots.map((slot) => pw.Container(
                margin: const pw.EdgeInsets.only(bottom: 10),
                padding: const pw.EdgeInsets.all(10),
                decoration: pw.BoxDecoration(
                  border: pw.Border.all(color: PdfColors.grey400),
                  borderRadius: const pw.BorderRadius.all(pw.Radius.circular(8))
                ),
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Text('Subject: ${slot['subject_code'] ?? ''}', style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
                    pw.SizedBox(height: 5),
                    pw.Text('Date: ${slot['date'] ?? slot['exam_date'] ?? ''}'),
                    pw.Text('Time: ${slot['exam_time'] ?? ''}'),
                    pw.Text('Room: ${slot['room_number'] ?? slot['room'] ?? ''}'),
                    pw.Text('Seat: ${slot['desk_number'] ?? slot['seat'] ?? ''}'),
                  ],
                ),
              )),
              pw.SizedBox(height: 40),
              pw.Center(
                child: pw.Column(
                  children: [
                    if (qrPayload.isNotEmpty)
                      pw.BarcodeWidget(
                        data: qrPayload,
                        barcode: pw.Barcode.qrCode(),
                        width: 150,
                        height: 150,
                      ),
                    pw.SizedBox(height: 10),
                    pw.Text('Scan at Gate for Instant Biometric Verification', style: const pw.TextStyle(fontSize: 10, color: PdfColors.grey700)),
                  ]
                )
              ),
            ],
          );
        },
      ),
    );

    await Printing.sharePdf(bytes: await pdf.save(), filename: 'HallTicket_$usn.pdf');
  }
}
