import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:nexai_student/main.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('NexAI Student smoke test', (WidgetTester tester) async {
    // No stored token -> the app must land on the login screen.
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(const NexAIStudentApp());
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 200));
    expect(find.text('NexAI Student Portal'), findsOneWidget);
  });
}
