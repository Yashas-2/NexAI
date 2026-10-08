import 'package:flutter_test/flutter_test.dart';
import 'package:nexai_invigilator/main.dart';

void main() {
  testWidgets('NexAI Invigilator smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const NexAIInvigilatorApp(isLoggedIn: false));
    expect(find.text('NexAI Invigilator'), findsOneWidget);
  });
}
