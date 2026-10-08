import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme/app_theme.dart';
import '../../services/api_service.dart';

class ResultsLedgerScreen extends StatefulWidget {
  const ResultsLedgerScreen({super.key});

  @override
  State<ResultsLedgerScreen> createState() => _ResultsLedgerScreenState();
}

class _ResultsLedgerScreenState extends State<ResultsLedgerScreen> {
  List<dynamic> _results = [];
  dynamic _profile;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    try {
      final resultsData = await ApiService.get('/student/portal/my_results/');
      final profileData = await ApiService.get('/student/portal/my_profile/');
      setState(() {
        _results = resultsData is List ? resultsData : [];
        _profile = profileData;
        _isLoading = false;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load results: $e'), backgroundColor: Colors.red),
        );
      }
      setState(() => _isLoading = false);
    }
  }

  void _openScriptScans(dynamic item) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        height: MediaQuery.of(context).size.height * 0.85,
        decoration: const BoxDecoration(
          color: AppTheme.bgSurface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          children: [
            Container(
              margin: const EdgeInsets.only(top: 12),
              width: 40,
              height: 4,
              decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2)),
            ),
            Padding(
              padding: const EdgeInsets.all(18),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Evaluated Script: ${item['subject_code'] ?? item['subject']}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                      Text('${item['subject_name'] ?? item['subject']} — ${item['exam_session_name'] ?? ''}', style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
                    ],
                  ),
                  IconButton(onPressed: () => Navigator.pop(context), icon: const Icon(Icons.close)),
                ],
              ),
            ),
            const Divider(height: 1),

            Expanded(
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    // Marks breakdown
                    _buildMarkRow('CIE Marks', item['cie_marks'] != null ? '${item['cie_marks']} / 50' : 'Not entered'),
                    const SizedBox(height: 8),
                    _buildMarkRow('SEE Marks', item['see_marks'] != null ? '${item['see_marks']} / 100' : 'Not evaluated'),
                    const SizedBox(height: 8),
                    _buildMarkRow('Total Marks', item['total_marks'] != null ? '${item['total_marks']} / 150' : 'Not available'),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: (item['grade'] == 'F')
                          ? AppTheme.accentRed.withValues(alpha: 0.1)
                          : AppTheme.accentGreen.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: (item['grade'] == 'F') ? AppTheme.accentRed : AppTheme.accentGreen,
                      ),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Grade', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
                        Text(
                          '${item['grade'] ?? 'N/A'}',
                          style: TextStyle(
                            fontWeight: FontWeight.w900,
                            fontSize: 24,
                            color: (item['grade'] == 'F') ? AppTheme.accentRed : AppTheme.accentGreen,
                          ),
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

  Widget _buildMarkRow(String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppTheme.bgBase,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppTheme.cardBorder),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppTheme.textSecondary)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14)),
        ],
      ),
    );
  }

  String _fmtGpa(dynamic value) {
    if (value == null) return '—';
    final parsed = double.tryParse(value.toString());
    return parsed != null ? parsed.toStringAsFixed(2) : '—';
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      backgroundColor: AppTheme.bgBase,
      appBar: AppBar(
        title: const Text('Academic Grade Ledger'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.only(left: 16, right: 16, top: 16, bottom: 96),
        child: Column(
          children: [
            // GPA Summary Cards
            Row(
              children: [
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('CUMULATIVE CGPA', style: TextStyle(color: Colors.white60, fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 0.5)),
                        const SizedBox(height: 6),
                        Text(_fmtGpa(_profile?['cgpa']), style: const TextStyle(color: Color(0xFF4ADE80), fontWeight: FontWeight.w900, fontSize: 26)),
                        const SizedBox(height: 4),
                        Text(_profile != null ? 'Semester ${_profile['semester'] ?? ''}' : 'No results yet', style: const TextStyle(color: Colors.white70, fontSize: 11)),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      color: AppTheme.primaryLight,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: AppTheme.primary.withValues(alpha: 0.3)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('LATEST SGPA', style: TextStyle(color: AppTheme.primaryDark, fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 0.5)),
                        const SizedBox(height: 6),
                        Text(_fmtGpa(_profile?['latest_sgpa']), style: const TextStyle(color: AppTheme.primaryDark, fontWeight: FontWeight.w900, fontSize: 26)),
                        const SizedBox(height: 4),
                        Text(_profile != null ? '${_profile['name'] ?? ''} — ${_profile['usn'] ?? ''}' : 'No results yet', style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11)),
                      ],
                    ),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 20),

            // Subject Grade Cards
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Course-wise Performance (${_results.length})', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
                const Text('CIE + SEE = 100 M', style: TextStyle(fontSize: 11, color: AppTheme.textSecondary)),
              ],
            ),
            const SizedBox(height: 12),
            if (_results.isEmpty) const Text('No results published yet.', style: TextStyle(color: Colors.red)),

            ..._results.map((res) {
              return Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppTheme.bgSurface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppTheme.cardBorder),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('${res['subject_code'] ?? res['subject']}: ${res['subject_name'] ?? ''}', style: GoogleFonts.inter(fontWeight: FontWeight.w800, fontSize: 14)),
                              Text('CIE: ${res['cie_marks'] ?? '—'}/50 | SEE: ${res['see_marks'] ?? '—'}/100', style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11)),
                            ],
                          ),
                        ),
                        Container(
                          width: 48,
                          height: 48,
                          decoration: BoxDecoration(
                            color: res['grade'] == 'F' ? Colors.red.withValues(alpha: 0.1) : AppTheme.primary.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Center(
                            child: Text(
                              res['grade'] ?? '—',
                              style: TextStyle(
                                fontSize: 22,
                                fontWeight: FontWeight.w900,
                                color: res['grade'] == 'F' ? Colors.red : AppTheme.primary,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 12),
                    const Divider(height: 1),
                    const SizedBox(height: 12),

                    Row(
                      children: [
                        Expanded(
                          child: Text('${res['exam_session_name'] ?? ''} • ${res['credits'] ?? '—'} Credits', style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary)),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: () => _openScriptScans(res),
                            icon: const Icon(Icons.document_scanner_outlined, size: 16),
                            label: const Text('View Script', style: TextStyle(fontSize: 11)),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              );
            }),
          ],
        ),
      ),
    );
  }
}
