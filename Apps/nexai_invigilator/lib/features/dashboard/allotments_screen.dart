import 'package:flutter/material.dart';
import '../../core/network/api_client.dart';
import '../../core/network/auth_service.dart';
import '../../core/theme/app_theme.dart';
import 'invigilator_home_screen.dart';
import '../auth/login_screen.dart';

class AllotmentsScreen extends StatefulWidget {
  const AllotmentsScreen({super.key});

  @override
  State<AllotmentsScreen> createState() => _AllotmentsScreenState();
}

class _AllotmentsScreenState extends State<AllotmentsScreen> {
  final ApiClient _apiClient = ApiClient();
  bool _isLoading = true;
  List<dynamic> _duties = [];
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _fetchDuties();
  }

  Future<void> _fetchDuties() async {
    try {
      final response = await _apiClient.get('/invigilation/?my_duties=true');
      final results = response['results'] ?? response;
      setState(() {
        _duties = (results as List).where((d) => d['timetable_slot'] != null).toList();
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = e.toString();
        _isLoading = false;
      });
    }
  }

  Future<void> _handleLogout() async {
    await AuthService.logout();
    if (mounted) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
    }
  }

  Future<void> _openDuty(Map<String, dynamic> duty) async {
    // Generate or fetch session key for this duty
    try {
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (_) => const Center(child: CircularProgressIndicator()),
      );

      final response = await _apiClient.post('/invigilator-keys/', {
        'duty_id': duty['id']
      });
      
      final sessionKey = response['session_key'];
      
      if (mounted) {
        Navigator.pop(context); // pop loading
        Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => InvigilatorHomeScreen(sessionKey: sessionKey)), // Passed the session key
        );
      }
    } catch (e) {
      if (mounted) {
        Navigator.pop(context); // pop loading
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error getting session key: $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
      appBar: AppBar(
        title: const Text('My Exam Duties', style: TextStyle(fontWeight: FontWeight.w700)),
        backgroundColor: Colors.white,
        foregroundColor: AppTheme.textPrimary,
        elevation: 0.5,
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: _handleLogout,
            tooltip: 'Logout',
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null
              ? Center(child: Text('Error: $_errorMessage', style: const TextStyle(color: Colors.red)))
              : _duties.isEmpty
                  ? const Center(child: Text('No duties assigned yet.', style: TextStyle(fontSize: 16)))
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: _duties.length,
                      itemBuilder: (context, index) {
                        final duty = _duties[index];
                        final role = duty['duty_role'] ?? 'INVIGILATOR';
                        final date = duty['exam_date'] ?? 'TBA';
                        final room = duty['room_name'] ?? 'TBA';
                        final start = duty['start_time'] != null ? duty['start_time'].toString().substring(0, 5) : 'TBA';
                        final end = duty['end_time'] != null ? duty['end_time'].toString().substring(0, 5) : 'TBA';

                        return Card(
                          margin: const EdgeInsets.only(bottom: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          elevation: 0,
                          child: InkWell(
                            borderRadius: BorderRadius.circular(16),
                            onTap: () => _openDuty(duty),
                            child: Padding(
                              padding: const EdgeInsets.all(16),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        date,
                                        style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: AppTheme.textPrimary),
                                      ),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                        decoration: BoxDecoration(
                                          color: role == 'CHIEF' ? Colors.purple.shade50 : Colors.blue.shade50,
                                          borderRadius: BorderRadius.circular(8),
                                        ),
                                        child: Text(
                                          role,
                                          style: TextStyle(
                                            color: role == 'CHIEF' ? Colors.purple.shade700 : Colors.blue.shade700,
                                            fontWeight: FontWeight.bold,
                                            fontSize: 12,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 12),
                                  Row(
                                    children: [
                                      const Icon(Icons.access_time, size: 16, color: AppTheme.textSecondary),
                                      const SizedBox(width: 6),
                                      Text('$start - $end', style: const TextStyle(color: AppTheme.textSecondary, fontWeight: FontWeight.w600)),
                                      const SizedBox(width: 16),
                                      const Icon(Icons.meeting_room, size: 16, color: AppTheme.textSecondary),
                                      const SizedBox(width: 6),
                                      Text(room, style: const TextStyle(color: AppTheme.textSecondary, fontWeight: FontWeight.w600)),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ),
                        );
                      },
                    ),
    );
  }
}
