import 'package:flutter/material.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/login_screen.dart';
import 'features/dashboard/allotments_screen.dart';
import 'core/network/auth_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final isLoggedIn = await AuthService.isLoggedIn();
  runApp(NexAIInvigilatorApp(isLoggedIn: isLoggedIn));
}

class NexAIInvigilatorApp extends StatelessWidget {
  final bool isLoggedIn;
  
  const NexAIInvigilatorApp({super.key, required this.isLoggedIn});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'NexAI Invigilator',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      home: isLoggedIn ? const AllotmentsScreen() : const LoginScreen(),
    );
  }
}
