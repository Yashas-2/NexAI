import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import '../../models/scanning_models.dart';
import '../dashboard/scanning_station_screen.dart';
import '../../core/network/api_client.dart';

class SessionKeyScreen extends StatefulWidget {
  const SessionKeyScreen({super.key});

  @override
  State<SessionKeyScreen> createState() => _SessionKeyScreenState();
}

class _SessionKeyScreenState extends State<SessionKeyScreen> {
  final _keyController = TextEditingController(text: 'SCAN-FALL26-CS201-B02');
  final _staffNameController = TextEditingController(text: 'Ramesh Verma (Staff #42)');
  String _selectedStation = 'Station 01';
  bool _isConnecting = false;

  void _handleQuickFill(String key, String course, String hall) {
    setState(() {
      _keyController.text = key;
    });
  }

  void _connectSession() async {
    final key = _keyController.text.trim();
    if (key.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: AppTheme.accentRed,
          content: Text('Please enter or scan an authorized Session Key'),
        ),
      );
      return;
    }

    setState(() => _isConnecting = true);

    try {
      // Verify session key with backend
      final sessionData = await ApiClient.verifySessionKey(key);

      if (!mounted) return;
      setState(() => _isConnecting = false);

      final session = ConnectedScanningSession(
        sessionKey: sessionData['session_key'] ?? key,
        courseCode: sessionData['course_code'] ?? (key.contains('EC301') ? 'EC301' : 'CS201'),
        courseTitle: sessionData['course_title'] ?? (key.contains('EC301') ? 'Digital Signal Processing' : 'Data Structures & Algorithms'),
        hallNumber: sessionData['hall_number'] ?? (key.contains('A101') ? 'Hall A-101' : 'Hall B-02'),
        expectedBooklets: sessionData['expected_booklets'] ?? (key.contains('A101') ? 25 : 30),
        stationId: _selectedStation,
        staffName: _staffNameController.text.trim(),
      );

      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (context) => ScanningStationScreen(session: session),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _isConnecting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: AppTheme.accentRed,
          content: Text('Connection failed: $e'),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bgBase,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 10),
              // Top Brand Tag
              Center(
                child: Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [AppTheme.primary, AppTheme.primaryDark],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [
                      BoxShadow(
                        color: AppTheme.primary.withValues(alpha: 0.35),
                        blurRadius: 16,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                  child: const Center(
                    child: Icon(Icons.document_scanner, color: Colors.white, size: 34),
                  ),
                ),
              ),
              const SizedBox(height: 18),

              Center(
                child: Column(
                  children: [
                    Text(
                      'NexAI Scanner Station',
                      style: Theme.of(context).textTheme.displayLarge?.copyWith(
                        fontSize: 22,
                        fontWeight: FontWeight.w900,
                        color: AppTheme.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Central Examination Paper Digitization Center',
                      style: TextStyle(fontSize: 12, color: AppTheme.textSecondary, fontWeight: FontWeight.w500),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 32),

              // Session Key Input Container
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: AppTheme.bgSurface,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppTheme.cardBorder),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.03),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'ENTER SESSION KEY',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.8,
                            color: AppTheme.primaryDark,
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: AppTheme.primaryLight,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: const Text(
                            'FROM DASHBOARD',
                            style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: AppTheme.primaryDark),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),

                    // Text Field
                    TextField(
                      controller: _keyController,
                      style: const TextStyle(
                        fontFamily: 'monospace',
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                        color: AppTheme.primaryDark,
                        letterSpacing: 1.2,
                      ),
                      decoration: InputDecoration(
                        prefixIcon: const Icon(Icons.qr_code, color: AppTheme.primary),
                        filled: true,
                        fillColor: AppTheme.bgBase,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: AppTheme.cardBorder),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: AppTheme.primary, width: 2),
                        ),
                      ),
                    ),

                    const SizedBox(height: 16),

                    // Quick Demo Session Buttons
                    const Text(
                      'Quick Authorized Sessions:',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppTheme.textSecondary),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        ActionChip(
                          avatar: const Icon(Icons.bolt, size: 14, color: AppTheme.primaryDark),
                          label: const Text('CS201 (Hall B-02)', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
                          backgroundColor: AppTheme.primaryLight,
                          side: const BorderSide(color: AppTheme.primary),
                          onPressed: () => _handleQuickFill('SCAN-FALL26-CS201-B02', 'CS201', 'Hall B-02'),
                        ),
                        ActionChip(
                          avatar: const Icon(Icons.bolt, size: 14, color: AppTheme.accentBlue),
                          label: const Text('EC301 (Hall A-101)', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
                          backgroundColor: const Color(0xFFEFF6FF),
                          side: const BorderSide(color: AppTheme.accentBlue),
                          onPressed: () => _handleQuickFill('SCAN-FALL26-EC301-A101', 'EC301', 'Hall A-101'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 20),

              // Station & Officer Info Card
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: AppTheme.bgSurface,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppTheme.cardBorder),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'SCANNING STATION ASSIGNMENT',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.8,
                        color: AppTheme.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 12),

                    DropdownButtonFormField<String>(
                      initialValue: _selectedStation,
                      decoration: InputDecoration(
                        labelText: 'Hardware Rig Station',
                        filled: true,
                        fillColor: AppTheme.bgBase,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      items: const [
                        DropdownMenuItem(value: 'Station 01', child: Text('Station 01 (Overhead Camera Rig)')),
                        DropdownMenuItem(value: 'Station 02', child: Text('Station 02 (Mobile Unit A)')),
                        DropdownMenuItem(value: 'Station 03', child: Text('Station 03 (Mobile Unit B)')),
                      ],
                      onChanged: (val) {
                        if (val != null) setState(() => _selectedStation = val);
                      },
                    ),

                    const SizedBox(height: 14),

                    TextField(
                      controller: _staffNameController,
                      decoration: InputDecoration(
                        labelText: 'Scanning Staff Name',
                        filled: true,
                        fillColor: AppTheme.bgBase,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 28),

              // Connect Button
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _isConnecting ? null : _connectSession,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primary,
                    padding: const EdgeInsets.symmetric(vertical: 18),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    elevation: 3,
                    shadowColor: AppTheme.primary.withValues(alpha: 0.4),
                  ),
                  child: _isConnecting
                      ? const SizedBox(
                          height: 22,
                          width: 22,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                        )
                      : const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.link, color: Colors.white, size: 20),
                            SizedBox(width: 8),
                            Text(
                              'Connect Workstation & Begin Scanning →',
                              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Colors.white),
                            ),
                          ],
                        ),
                ),
              ),

              const SizedBox(height: 20),

              // Security Footer
              Center(
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.lock_outline, size: 14, color: Colors.grey.shade500),
                    const SizedBox(width: 6),
                    Text(
                      'Protected by NexAI Cryptographic Ingestion Protocol',
                      style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
