import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme/app_theme.dart';
import '../../models/student_models.dart';
import '../exam_sandbox/widgets/digital_paper_canvas.dart';
import '../exam_sandbox/widgets/full_question_paper_modal.dart';
import 'widgets/ai_proctor_camera_bubble.dart';
import '../../services/api_service.dart';
import 'dart:async';

enum ResponseInputMode { digitalPen, typedText, mcq }

class ProctoredExamKioskScreen extends StatefulWidget {
  final ExamScheduleItem exam;

  const ProctoredExamKioskScreen({
    super.key,
    required this.exam,
  });

  @override
  State<ProctoredExamKioskScreen> createState() => _ProctoredExamKioskScreenState();
}

class _ProctoredExamKioskScreenState extends State<ProctoredExamKioskScreen> with WidgetsBindingObserver {
  int _currentQuestionIndex = 0;
  List<ExamQuestionItem> _questions = [];
  bool _isSubmitted = false;
  bool _isBlankSubmission = false;
  ResponseInputMode _inputMode = ResponseInputMode.digitalPen;
  bool _isQuestionExpanded = true;
  int _strikeCount = 0;
  bool _isLoadingQuestions = true;
  String? _countdownMessage;
  Timer? _countdownTimer;
  String _submissionReceiptHash = '';
  int? _serverIntegrityScore;

  // ── Paper availability (empty state — never fabricated questions) ────────
  /// Non-null when there is no paper to show; the UI renders the
  /// "Question paper not available yet" empty state with this detail line.
  String? _paperUnavailableDetail;
  /// True when the failure is retryable (e.g. network), false for
  /// not-yet-available / not-eligible states.
  bool _paperLoadFailed = false;
  String? _paperInstructions;

  int get _integrityScore =>
      _serverIntegrityScore ?? (((3 - _strikeCount) / 3 * 100).round().clamp(0, 100));

  /// Sum of the real question marks — used when the API omits total_marks.
  int get _totalMarks => _examTotalMarks ??
      _questions.fold(0, (sum, q) => sum + q.maxMarks);

  // ── Exam Countdown Timer ──────────────────────────────────────────────────
  /// Remaining seconds for the exam. Initialised from the API response.
  int _examRemainingSeconds = 0;
  /// Duration/marks come exclusively from the question-paper API — there are
  /// no hardcoded defaults; null means "not provided" and is shown as '—'.
  int? _examDurationMins;
  int? _examTotalMarks;
  Timer? _examTimer;
  /// Student USN shown in the AppBar.
  String _studentUsn = '';

  // ── Answer auto-save ──────────────────────────────────────────────────────
  Timer? _autoSaveTimer;
  bool _autoSaveInFlight = false;
  /// hashCode of each question's last successfully synced script image.
  final Map<int, int> _syncedImageHashes = {};
  DateTime? _lastAutoSaveAt;

  final TextEditingController _answerController = TextEditingController();
  final Map<int, GlobalKey<DigitalPaperCanvasState>> _canvasKeys = {};
  static const platform = MethodChannel('com.nexai.kiosk/lock');

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);

    // Lock device in immersive kiosk mode and Android Screen Pinning
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    _enableKioskMode();
    _loadStudentProfile();
    _fetchQuestions();
  }

  Future<void> _loadStudentProfile() async {
    try {
      final data = await ApiService.get('/student/portal/my_profile/');
      if (mounted) {
        setState(() {
          _studentUsn = data['usn'] ?? data['roll_number'] ?? '';
        });
      }
    } catch (_) {}
  }

  void _startExamTimer(int durationMinutes) {
    _examRemainingSeconds = durationMinutes * 60;
    _examTimer?.cancel();
    _examTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_examRemainingSeconds <= 0) {
        timer.cancel();
        if (!_isSubmitted) _handleSubmitExam(); // Auto-submit on time up
      } else {
        if (mounted) setState(() => _examRemainingSeconds--);
      }
    });
  }

  String _formatExamTime() {
    final h = _examRemainingSeconds ~/ 3600;
    final m = (_examRemainingSeconds % 3600) ~/ 60;
    final s = _examRemainingSeconds % 60;
    if (h > 0) {
      return '${h.toString().padLeft(2, '0')}:${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
    }
    return '${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
  }

  /// Map backend question types onto the app's input-mode vocabulary.
  static String _normalizeType(dynamic raw) {
    final v = '${raw ?? ''}'.toUpperCase();
    if (v == 'MCQ') return 'MCQ';
    if (v == 'CODE') return 'CODE';
    return 'THEORY';
  }

  static int? _tryInt(dynamic value) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    if (value is String) return int.tryParse(value);
    return null;
  }

  /// Flatten the released paper into answering units.
  ///
  /// The backend groups sub-questions under their parent
  /// (`{questionNumber: 1, subQuestions: [{part: 'a', …}, …]}`); every
  /// sub-question becomes its own item with its own marks and answer area.
  List<ExamQuestionItem> _parseQuestions(dynamic content) {
    final rawList = ((content is Map ? content['questions'] : null) as List?) ?? [];
    final items = <ExamQuestionItem>[];

    for (final raw in rawList) {
      if (raw is! Map) continue;
      final qnum = _tryInt(raw['questionNumber']) ?? 0;
      final section = raw['section']?.toString();
      final type = _normalizeType(raw['type']);

      final subs = (raw['subQuestions'] as List?) ?? [];
      if (subs.isNotEmpty) {
        for (final s in subs) {
          if (s is! Map) continue;
          final part = (s['part'] ?? '').toString();
          items.add(ExamQuestionItem(
            questionNumber: _tryInt(s['questionNumber']) ?? qnum,
            part: part.isEmpty ? null : part,
            section: section,
            questionText: (s['questionText'] ?? '').toString(),
            maxMarks: _tryInt(s['marks']) ?? 0,
            type: _normalizeType(s['type'] ?? type),
            options: (s['options'] as List?)?.map((e) => e.toString()).toList(),
          ));
        }
      } else {
        final part = (raw['part'] ?? '').toString();
        items.add(ExamQuestionItem(
          questionNumber: qnum,
          part: part.isEmpty ? null : part,
          section: section,
          questionText: (raw['questionText'] ?? '').toString(),
          maxMarks: _tryInt(raw['marks']) ?? 0,
          type: type,
          options: (raw['options'] as List?)?.map((e) => e.toString()).toList(),
        ));
      }
    }
    return items;
  }

  void _setPaperUnavailable({required String detail, bool retryable = false}) {
    setState(() {
      _questions = [];
      _isLoadingQuestions = false;
      _countdownTimer?.cancel();
      _paperUnavailableDetail = detail;
      _paperLoadFailed = retryable;
    });
  }

  Future<void> _fetchQuestions() async {
    if (widget.exam.questionPaperId == null) {
      _setPaperUnavailable(
        detail: 'No finalized question paper has been linked to this exam yet.',
        retryable: true,
      );
      return;
    }

    try {
      final response = await ApiService.get('/vault/question-papers/${widget.exam.questionPaperId}/time_release/');

      if (response['status'] == 'unlocked') {
        final content = response['content'];
        final parsed = _parseQuestions(content);
        if (parsed.isEmpty) {
          _setPaperUnavailable(
            detail: 'The released paper contains no questions yet.',
          );
          return;
        }

        final int? durationMins =
            _tryInt(response['duration_mins']) ?? _tryInt(content is Map ? content['duration_mins'] : null);
        final int? totalMarks =
            _tryInt(response['total_marks']) ?? _tryInt(content is Map ? content['total_marks'] : null);
        final instructions = response['instructions'];

        setState(() {
          _questions = parsed;
          _currentQuestionIndex = 0;
          _isLoadingQuestions = false;
          _paperUnavailableDetail = null;
          _paperLoadFailed = false;
          _paperInstructions =
              (instructions is String && instructions.trim().isNotEmpty) ? instructions : null;
          _examDurationMins = durationMins;
          _examTotalMarks = totalMarks;
          _countdownTimer?.cancel();
          _updateAnswerController();
        });

        _startAutoSave();
        if (durationMins != null) _startExamTimer(durationMins);
      } else {
        _setPaperUnavailable(
          detail: 'The question paper for this exam has not been released yet.',
        );
      }
    } catch (e) {
      final errStr = e.toString();
      if (errStr.contains('remaining_seconds')) {
        // Unlocks shortly — show the countdown and retry when it elapses.
        final RegExp regex = RegExp(r'remaining_seconds.*?(\d+)');
        final match = regex.firstMatch(errStr);
        int remainingSeconds = match != null ? int.parse(match.group(1)!) : 120;

        setState(() {
          _isLoadingQuestions = true;
          _countdownMessage = "Questions unlock in ${_formatDuration(remainingSeconds)}";
        });

        _startCountdown(remainingSeconds);
      } else if (errStr.contains('not approved') || errStr.contains('not been finalized')) {
        _setPaperUnavailable(
          detail: 'The question paper for this exam has not been finalized yet.',
        );
      } else if (errStr.contains('not eligible')) {
        _setPaperUnavailable(
          detail: 'You are not eligible to write this exam.',
        );
      } else {
        _setPaperUnavailable(
          detail: 'Error: $errStr',
          retryable: true,
        );
      }
    }
  }

  // ── Answer auto-save ──────────────────────────────────────────────────────
  void _startAutoSave() {
    _autoSaveTimer?.cancel();
    _autoSaveTimer = Timer.periodic(const Duration(seconds: 10), (_) {
      if (!_isSubmitted && _questions.isNotEmpty) {
        _saveCurrentAnswer();
        _syncDraftToServer();
      }
    });
  }

  /// Build the answers payload for the draft auto-save endpoint.
  /// Script images are included only when they changed since the last
  /// successful sync (tracked by hash) to avoid re-uploading unchanged pages.
  List<Map<String, dynamic>> _buildDraftAnswers() {
    final answers = <Map<String, dynamic>>[];
    for (var i = 0; i < _questions.length; i++) {
      final q = _questions[i];
      final image = q.answerImageBase64 ?? '';
      final imageDirty = image.isNotEmpty && _syncedImageHashes[i] != image.hashCode;
      final hasText = (q.candidateAnswer ?? '').trim().isNotEmpty;
      if (!hasText && image.isEmpty && !q.isAnswered) continue;

      answers.add({
        "question_number": q.questionNumber,
        "part": q.part ?? '',
        "question_text": q.questionText,
        "answer_text": q.candidateAnswer ?? "",
        if (imageDirty) "answer_image_base64": image,
      });
    }
    return answers;
  }

  Future<void> _syncDraftToServer() async {
    if (_isSubmitted || _questions.isEmpty || _autoSaveInFlight) return;
    final answers = _buildDraftAnswers();
    if (answers.isEmpty) return;

    _autoSaveInFlight = true;
    try {
      final savePath = widget.exam.isCie
          ? '/cie/test/kiosk_save_answer/'
          : '/student/portal/see_save_answer/';
      await ApiService.post(savePath, {
        "subject_code": widget.exam.courseCode,
        "answers": answers,
      });

      // Mark every non-empty image as synced.
      for (var i = 0; i < _questions.length; i++) {
        final image = _questions[i].answerImageBase64 ?? '';
        if (image.isNotEmpty) _syncedImageHashes[i] = image.hashCode;
      }
      if (mounted) setState(() => _lastAutoSaveAt = DateTime.now());
    } catch (e) {
      // Silent — the next tick retries; final submit re-sends everything.
      debugPrint('Draft auto-save failed: $e');
    } finally {
      _autoSaveInFlight = false;
    }
  }

  void _startCountdown(int seconds) {
    _countdownTimer?.cancel();
    int current = seconds;
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (current <= 0) {
        timer.cancel();
        _fetchQuestions(); // Try fetching again
      } else {
        setState(() {
          current--;
          _countdownMessage = "Questions unlock in ${_formatDuration(current)}";
        });
      }
    });
  }

  String _formatDuration(int seconds) {
    final mins = seconds ~/ 60;
    final secs = seconds % 60;
    return '${mins.toString().padLeft(2, '0')}:${secs.toString().padLeft(2, '0')}';
  }

  Future<void> _enableKioskMode() async {
    try {
      await platform.invokeMethod('startKioskMode');
    } on PlatformException catch (e) {
      debugPrint("Failed to start kiosk mode: '${e.message}'.");
    }
  }

  Future<void> _disableKioskMode() async {
    try {
      await platform.invokeMethod('stopKioskMode');
    } on PlatformException catch (e) {
      debugPrint("Failed to stop kiosk mode: '${e.message}'.");
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);
    if (state == AppLifecycleState.inactive || state == AppLifecycleState.paused) {
      // Focus lost - Malpractice Warning
      _handleFocusLostWarning();
    }
  }

  void _handleFocusLostWarning() {
    if (_isSubmitted) return;

    setState(() {
      if (_strikeCount < 3) _strikeCount++;
    });

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1E1B4B),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Row(
          children: [
            Icon(Icons.warning_amber_rounded, color: Color(0xFFEF4444), size: 28),
            SizedBox(width: 8),
            Text('Proctor Security Alert', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 16)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'App Focus Loss / Screen Switch Detected!',
              style: TextStyle(color: Color(0xFFFCA5A5), fontWeight: FontWeight.w800, fontSize: 13),
            ),
            const SizedBox(height: 8),
            Text(
              'Leaving the examination kiosk or opening split-screen is recorded as a malpractice violation.\n\nStrike Recorded: $_strikeCount of 3',
              style: const TextStyle(color: Colors.white70, fontSize: 12),
            ),
          ],
        ),
        actions: [
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.accentRed),
            child: const Text('Return to Assessment', style: TextStyle(fontWeight: FontWeight.w800)),
          ),
        ],
      ),
    );
  }

  void _handleProctorWarning() {
    setState(() {
      if (_strikeCount < 3) {
        _strikeCount++;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: AppTheme.accentAmber,
            content: Text('⚠️ Proctor Warning: Strike $_strikeCount/3'),
          ),
        );
      }
      if (_strikeCount >= 3 && !_isSubmitted) {
        _isSubmitted = true;
        _disableKioskMode();
        SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: AppTheme.accentRed,
            content: Text('Exam Auto-Terminated due to 3 Strikes!'),
            duration: Duration(seconds: 4),
          ),
        );
      }
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _countdownTimer?.cancel();
    _examTimer?.cancel();
    _autoSaveTimer?.cancel();
    _answerController.dispose();
    // Restore normal system navigation and unpin screen
    _disableKioskMode();
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    super.dispose();
  }

  void _updateAnswerController() {
    if (_questions.isEmpty) return;
    _answerController.text = _questions[_currentQuestionIndex].candidateAnswer ?? '';
    if (_questions[_currentQuestionIndex].type == 'MCQ') {
      _inputMode = ResponseInputMode.mcq;
    } else {
      _inputMode = ResponseInputMode.digitalPen;
    }
  }

  Future<void> _saveCurrentAnswer() async {
    String? capturedImage;
    bool canvasHasDrawn = false;
    final canvasKey = _canvasKeys[_currentQuestionIndex];
    if (_inputMode == ResponseInputMode.digitalPen && canvasKey?.currentState != null) {
      try {
        canvasHasDrawn = canvasKey!.currentState!.hasDrawn;
        capturedImage = await canvasKey.currentState!.captureAsBase64();
      } catch (e) {
        debugPrint('Canvas capture failed: $e');
      }
    }
    final textAnswer = _answerController.text.trim();
    setState(() {
      _questions[_currentQuestionIndex].candidateAnswer = textAnswer;
      if (capturedImage != null && capturedImage.isNotEmpty) {
        _questions[_currentQuestionIndex].answerImageBase64 = capturedImage;
      }
      _questions[_currentQuestionIndex].isAnswered =
          textAnswer.isNotEmpty ||
          canvasHasDrawn ||
          _questions[_currentQuestionIndex].answerImageBase64?.isNotEmpty == true;
    });
  }

  void _handleOptionSelected(String option) {
    setState(() {
      _questions[_currentQuestionIndex].candidateAnswer = option;
      _questions[_currentQuestionIndex].isAnswered = true;
    });
  }

  Future<void> _openFullQuestionPaper() async {
    await _saveCurrentAnswer();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => FullQuestionPaperModal(
        questions: _questions,
        exam: widget.exam,
        totalMarks: _totalMarks,
        durationMins: _examDurationMins,
        instructions: _paperInstructions,
        usn: _studentUsn,
        sessionName: widget.exam.sessionName,
        onSelectQuestion: (idx) {
          setState(() {
            _currentQuestionIndex = idx;
            _updateAnswerController();
          });
        },
      ),
    );
  }

  Future<void> _handleSubmitExam() async {
    await _saveCurrentAnswer();
    
    // Check if the paper is blank — considers typed text, handwriting, canvas draws, AND extra pages
    bool hasAnswers = _questions.any((q) {
      bool hasText = q.candidateAnswer?.trim().isNotEmpty == true;
      bool hasImage = q.answerImageBase64?.isNotEmpty == true;
      bool hasExtraPages = q.totalPages > 1;
      return hasText || hasImage || hasExtraPages;
    });

    // Also check if any canvas was drawn on
    if (!hasAnswers) {
      for (final key in _canvasKeys.values) {
        if (key.currentState?.hasDrawn == true) {
          hasAnswers = true;
          break;
        }
      }
    }

    bool isBlank = !hasAnswers;

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(isBlank ? 'Confirm Blank Submission' : 'Confirm Final Exam Submission'),
        content: Text(
          isBlank 
            ? 'You have not written any answers. If you submit now, your exam will be recorded as "Not Submitted". Are you sure you want to exit?'
            : 'Are you sure you want to finish and submit? This will seal your digital answer booklet with your cryptographic signature and safely exit AI Proctored Kiosk Mode.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Return to Exam'),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(context);
              
              try {
                final answers = _questions.map((q) => {
                  "question_number": q.questionNumber,
                  "part": q.part ?? "",
                  "question_text": q.questionText,
                  "answer_text": q.candidateAnswer ?? "",
                  "answer_image_base64": q.answerImageBase64 ?? "",
                }).toList();

                // CIE submits to the CIE endpoint; SEE has its own attempt store.
                final submitPath = widget.exam.isCie
                    ? '/cie/test/kiosk_submit/'
                    : '/student/portal/see_submit/';
                final response = await ApiService.post(submitPath, {
                  "subject_code": widget.exam.courseCode,
                  "answers": answers,
                  "strike_count": _strikeCount,
                });
                
                if (response['receipt_hash'] != null && mounted) {
                  setState(() {
                    _submissionReceiptHash = response['receipt_hash'];
                    final score = response['integrity_score'];
                    if (score is num) _serverIntegrityScore = score.toInt();
                  });
                }
                
                // Only proceed if API is successful
                setState(() => _isSubmitted = true);
                // Save blank state for the receipt
                _isBlankSubmission = isBlank;
                // Restore system navigation upon completion and unpin screen
                _disableKioskMode();
                SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);

              } catch (e) {
                if (mounted) {
                  String errorMsg = e.toString();
                  if (errorMsg.contains('Already Submitted')) {
                    errorMsg = 'Exam Already Submitted! You cannot submit again.';
                  } else {
                    errorMsg = 'API Error: $e';
                  }
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(errorMsg),
                      backgroundColor: AppTheme.accentRed,
                      duration: const Duration(seconds: 10),
                    ),
                  );
                }
              }
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primary),
            child: const Text('Submit & Exit Proctor Mode ✓'),
          ),
        ],
      ),
    );
  }

  void _addNewPage() {
    setState(() {
      _questions[_currentQuestionIndex].totalPages++;
      _questions[_currentQuestionIndex].currentPageNumber = _questions[_currentQuestionIndex].totalPages;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        backgroundColor: AppTheme.primaryDark,
        content: Text('✓ Attached Extra Sheet (Page ${_questions[_currentQuestionIndex].totalPages})'),
        duration: const Duration(seconds: 1),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoadingQuestions) {
      return Scaffold(
        backgroundColor: AppTheme.bgBase,
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.lock_clock, color: AppTheme.accentBlue, size: 64),
              const SizedBox(height: 24),
              const Text(
                'Awaiting Vault Decryption',
                style: TextStyle(color: Color(0xFFFBBF24), fontSize: 24, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 12),
              Text(
                _countdownMessage ?? 'Loading securely...',
                style: const TextStyle(color: Color(0xFFFDE68A), fontSize: 16, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 32),
              const CircularProgressIndicator(color: AppTheme.accentBlue),
            ],
          ),
        ),
      );
    }

    if (_paperUnavailableDetail != null) return _buildPaperUnavailable();
    // Defensive: never index an empty question list (RangeError guard).
    if (!_isSubmitted && _questions.isEmpty) return _buildPaperUnavailable();

    // Intercept back button to prevent accidental exit
    return PopScope(
      canPop: _isSubmitted,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop && !_isSubmitted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              backgroundColor: AppTheme.accentRed,
              content: Text('⚠️ Cannot exit locked exam without submitting. Tap "Submit Exam" at the bottom.'),
            ),
          );
        }
      },
      child: Scaffold(
        backgroundColor: AppTheme.bgBase,
        appBar: AppBar(
          automaticallyImplyLeading: false,
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${widget.exam.courseCode}: ${widget.exam.courseTitle}',
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              Row(
                children: [
                  Container(width: 8, height: 8, decoration: const BoxDecoration(color: Color(0xFF4ADE80), shape: BoxShape.circle)),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      _studentUsn.isEmpty
                          ? 'AI Proctoring Active • Kiosk Mode'
                          : 'USN: $_studentUsn  •  AI Proctoring Active',
                      style: const TextStyle(fontSize: 10, color: AppTheme.accentGreen, fontWeight: FontWeight.w700),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ],
          ),
          actions: [
            // Complete Question Paper Button
            InkWell(
              onTap: _openFullQuestionPaper,
              borderRadius: BorderRadius.circular(8),
              child: Container(
                margin: const EdgeInsets.symmetric(vertical: 8),
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppTheme.primary,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.description, color: Colors.white, size: 14),
                    SizedBox(width: 4),
                    Text(
                      'Full QP',
                      style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 11),
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(width: 8),

            // Last auto-save indicator
            if (_lastAutoSaveAt != null)
              Container(
                margin: const EdgeInsets.only(right: 8, top: 8, bottom: 8),
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppTheme.bgDark,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  'Saved ${_lastAutoSaveAt!.hour.toString().padLeft(2, '0')}:${_lastAutoSaveAt!.minute.toString().padLeft(2, '0')}',
                  style: const TextStyle(
                    color: AppTheme.accentGreen,
                    fontWeight: FontWeight.w800,
                    fontSize: 10,
                  ),
                ),
              ),

            // Live Countdown Timer
            Container(
              margin: const EdgeInsets.only(right: 12, top: 8, bottom: 8),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: _examRemainingSeconds > 0 && _examRemainingSeconds <= 300
                    ? AppTheme.accentRed.withValues(alpha: 0.2)
                    : AppTheme.bgDark,
                borderRadius: BorderRadius.circular(8),
                border: _examRemainingSeconds > 0 && _examRemainingSeconds <= 300
                    ? Border.all(color: AppTheme.accentRed, width: 1)
                    : null,
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.timer,
                    color: _examRemainingSeconds > 0 && _examRemainingSeconds <= 300
                        ? AppTheme.accentRed
                        : const Color(0xFFFBBF24),
                    size: 14,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    _examDurationMins == null
                        ? '--:--'
                        : (_examRemainingSeconds > 0 ? _formatExamTime() : 'Time Up!'),
                    style: TextStyle(
                      color: _examRemainingSeconds > 0 && _examRemainingSeconds <= 300
                          ? AppTheme.accentRed
                          : Colors.white,
                      fontWeight: FontWeight.w900,
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        body: _isSubmitted ? _buildSubmissionReceipt() : _buildExamWorkspace(q: _questions[_currentQuestionIndex]),
      ),
    );
  }

  /// Empty state shown when there is no paper to answer — never fabricated.
  Widget _buildPaperUnavailable() {
    return Scaffold(
      backgroundColor: AppTheme.bgBase,
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, color: AppTheme.accentRed, size: 64),
              const SizedBox(height: 24),
              const Text(
                'Question paper not available yet',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 12),
              Text(
                _paperUnavailableDetail ??
                    'The question paper for this exam has not been loaded yet.',
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white70, fontSize: 16),
              ),
              const SizedBox(height: 32),
              if (_paperLoadFailed)
                ElevatedButton.icon(
                  icon: const Icon(Icons.refresh),
                  label: const Text('Retry'),
                  style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primary),
                  onPressed: () {
                    setState(() {
                      _isLoadingQuestions = true;
                      _paperUnavailableDetail = null;
                    });
                    _fetchQuestions();
                  },
                ),
              const SizedBox(height: 16),
              TextButton.icon(
                icon: const Icon(Icons.arrow_back),
                label: const Text('Back'),
                style: TextButton.styleFrom(foregroundColor: Colors.white54),
                onPressed: () {
                  _disableKioskMode();
                  Navigator.of(context).pop();
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSubmissionReceipt() {
    if (_isBlankSubmission) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 84,
                height: 84,
                decoration: BoxDecoration(
                  color: const Color(0xFFFEE2E2),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.cancel_presentation, color: AppTheme.accentRed, size: 50),
              ),
              const SizedBox(height: 20),
              Text(
                'Exam Not Submitted',
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(fontWeight: FontWeight.w900, fontSize: 20, color: AppTheme.accentRed),
              ),
              const SizedBox(height: 8),
              const Text(
                'You exited the exam without recording any answers on your digital booklet. Your status has been marked as Not Submitted.',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppTheme.textSecondary, fontSize: 12),
              ),
              const SizedBox(height: 28),
              ElevatedButton(
                onPressed: () {
                  SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
                  Navigator.pop(context);
                },
                style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primaryDark),
                child: const Text('Back to Student Portal'),
              ),
            ],
          ),
        ),
      );
    }

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 84,
              height: 84,
              decoration: const BoxDecoration(
                color: Color(0xFFDCFCE7),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.verified_user, color: AppTheme.accentGreen, size: 50),
            ),
            const SizedBox(height: 20),
            Text(
              'Assessment Submitted & Kiosk Released!',
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(fontWeight: FontWeight.w900, fontSize: 20),
            ),
            const SizedBox(height: 8),
            const Text(
              'Your handwritten digital booklet and diagram responses have been cryptographically hashed and uploaded to the NexAI Evaluation Vault. AI Proctor stream closed.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppTheme.textSecondary, fontSize: 12),
            ),
            const SizedBox(height: 24),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppTheme.bgSurface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppTheme.cardBorder),
              ),
              child: Column(
                children: [
                  const Text('DIGITAL SUBMISSION RECEIPT HASH:', style: TextStyle(fontSize: 10, color: AppTheme.textSecondary, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 4),
                  Text(
                    _submissionReceiptHash.isNotEmpty ? _submissionReceiptHash : 'Unavailable',
                    style: const TextStyle(fontFamily: 'monospace', fontWeight: FontWeight.w800, color: AppTheme.accentBlue),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'PROCTOR INTEGRITY SCORE: $_integrityScore% (Strikes: $_strikeCount/3)',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      color: _integrityScore >= 100
                          ? AppTheme.accentGreen
                          : (_integrityScore >= 60 ? AppTheme.accentAmber : AppTheme.accentRed),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 28),
            ElevatedButton(
              onPressed: () {
                SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
                Navigator.pop(context);
              },
              child: const Text('Back to Student Portal'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildExamWorkspace({required ExamQuestionItem q}) {
    return Stack(
      children: [
        // Main Body
        Positioned.fill(
          child: Column(
            children: [
              // ── Row 1: Question Selector Tabs ──
              Container(
                height: 48,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                color: AppTheme.bgSurface,
                child: Row(
                  children: [
                    // Quick Full Paper Pill
                    InkWell(
                      onTap: _openFullQuestionPaper,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                        margin: const EdgeInsets.only(right: 8),
                        decoration: BoxDecoration(
                          color: AppTheme.primaryLight,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: AppTheme.primary.withValues(alpha: 0.4)),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.menu_book, color: AppTheme.primaryDark, size: 14),
                            SizedBox(width: 4),
                            Text(
                              'Paper',
                              style: TextStyle(color: AppTheme.primaryDark, fontWeight: FontWeight.w800, fontSize: 11),
                            ),
                          ],
                        ),
                      ),
                    ),

                    Expanded(
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: _questions.length,
                        separatorBuilder: (context, i) => const SizedBox(width: 8),
                        itemBuilder: (context, i) {
                          final isCurrent = i == _currentQuestionIndex;
                          final isAnswered = _questions[i].isAnswered;

                          return InkWell(
                            onTap: () async {
                              await _saveCurrentAnswer();
                              setState(() {
                                _currentQuestionIndex = i;
                                _updateAnswerController();
                              });
                            },
                            borderRadius: BorderRadius.circular(8),
                            child: Container(
                              width: 44,
                              decoration: BoxDecoration(
                                color: isCurrent ? AppTheme.primary : (isAnswered ? AppTheme.accentGreen.withValues(alpha: 0.15) : AppTheme.bgBase),
                                border: Border.all(
                                  color: isCurrent ? AppTheme.primary : (isAnswered ? AppTheme.accentGreen : AppTheme.cardBorder),
                                  width: 1.5,
                                ),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              alignment: Alignment.center,
                              child: Text(
                                _questions[i].tabLabel,
                                style: TextStyle(
                                  fontWeight: FontWeight.w800,
                                  fontSize: 12,
                                  color: isCurrent ? Colors.white : (isAnswered ? AppTheme.accentGreen : AppTheme.textPrimary),
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ),

                    // Response Mode Switcher (Pen vs Keyboard)
                    if (q.type != 'MCQ')
                      Container(
                        margin: const EdgeInsets.only(left: 8),
                        padding: const EdgeInsets.all(2),
                        decoration: BoxDecoration(
                          color: AppTheme.bgBase,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: AppTheme.cardBorder),
                        ),
                        child: Row(
                          children: [
                            _buildModeButton(
                              icon: Icons.edit_note,
                              tooltip: 'Digital Pen & Paper',
                              isSelected: _inputMode == ResponseInputMode.digitalPen,
                              onTap: () => setState(() => _inputMode = ResponseInputMode.digitalPen),
                            ),
                            _buildModeButton(
                              icon: Icons.keyboard,
                              tooltip: 'Type / Code Editor',
                              isSelected: _inputMode == ResponseInputMode.typedText,
                              onTap: () => setState(() => _inputMode = ResponseInputMode.typedText),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
              const Divider(height: 1),

              // ── Row 2: Question Header Banner (Collapsible) ──
              InkWell(
                onTap: () => setState(() => _isQuestionExpanded = !_isQuestionExpanded),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  color: const Color(0xFFF1F5F9),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppTheme.primaryDark,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          '${q.label} (${q.maxMarks}M)',
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 11),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          q.questionText,
                          maxLines: _isQuestionExpanded ? 4 : 1,
                          overflow: TextOverflow.ellipsis,
                          softWrap: true,
                          style: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 13, color: AppTheme.textPrimary),
                        ),
                      ),
                      Icon(
                        _isQuestionExpanded ? Icons.expand_less : Icons.expand_more,
                        size: 18,
                        color: AppTheme.textSecondary,
                      ),
                    ],
                  ),
                ),
              ),

              // ── Main Answering Area (Physical Paper Drawing vs Typed Editor) ──
              Expanded(
                child: _inputMode == ResponseInputMode.digitalPen
                    ? DigitalPaperCanvas(
                        key: _canvasKeys.putIfAbsent(_currentQuestionIndex, () => GlobalKey<DigitalPaperCanvasState>()),
                        questionTitle: q.label,
                        pageNumber: q.currentPageNumber,
                        totalPages: q.totalPages,
                        onPageAdded: _addNewPage,
                        initialImageBase64: q.answerImageBase64,
                      )
                    : _buildAlternativeInputView(q),
              ),

              // ── Bottom Sheet & Actions Bar ──
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: const BoxDecoration(
                  color: AppTheme.bgSurface,
                  border: Border(top: BorderSide(color: AppTheme.cardBorder)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    // Booklet Page Navigation Strip
                    if (_inputMode == ResponseInputMode.digitalPen)
                      Expanded(
                        child: SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          child: Row(
                            children: [
                              IconButton(
                                onPressed: _questions[_currentQuestionIndex].currentPageNumber > 1 ? () => setState(() => _questions[_currentQuestionIndex].currentPageNumber--) : null,
                                icon: const Icon(Icons.chevron_left, size: 20),
                                padding: EdgeInsets.zero,
                                constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                              ),
                              Text(
                                'Page ${_questions[_currentQuestionIndex].currentPageNumber} / ${_questions[_currentQuestionIndex].totalPages}',
                                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12),
                              ),
                              IconButton(
                                onPressed: _questions[_currentQuestionIndex].currentPageNumber < _questions[_currentQuestionIndex].totalPages ? () => setState(() => _questions[_currentQuestionIndex].currentPageNumber++) : null,
                                icon: const Icon(Icons.chevron_right, size: 20),
                                padding: EdgeInsets.zero,
                                constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                              ),
                              const SizedBox(width: 4),
                              InkWell(
                                onTap: _addNewPage,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: AppTheme.primaryLight,
                                    borderRadius: BorderRadius.circular(6),
                                    border: Border.all(color: AppTheme.primary.withValues(alpha: 0.3)),
                                  ),
                                  child: const Text('+ Extra Sheet', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: AppTheme.primaryDark)),
                                ),
                              ),
                            ],
                          ),
                        ),
                      )
                    else
                      const Expanded(child: Text('Text Editor Active', style: TextStyle(fontSize: 11, color: AppTheme.textSecondary))),
                    
                    const SizedBox(width: 8),
                    // Prev / Next / Finish Buttons
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Previous Button
                        if (_currentQuestionIndex > 0)
                          ElevatedButton(
                            onPressed: () async {
                              await _saveCurrentAnswer();
                              setState(() {
                                _currentQuestionIndex--;
                                _updateAnswerController();
                              });
                            },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppTheme.bgBase,
                              side: BorderSide(color: AppTheme.primary),
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                            ),
                            child: const Text('← Prev Q', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: AppTheme.primary)),
                          ),
                        if (_currentQuestionIndex > 0) const SizedBox(width: 8),
                        // Next / Finish Button
                        if (_currentQuestionIndex < _questions.length - 1)
                          ElevatedButton(
                            onPressed: () async {
                              await _saveCurrentAnswer();
                              setState(() {
                                _currentQuestionIndex++;
                                _updateAnswerController();
                              });
                            },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppTheme.primary,
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                            ),
                            child: const Text('Next Q →', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
                          )
                        else
                          ElevatedButton.icon(
                            onPressed: _handleSubmitExam,
                            icon: const Icon(Icons.check, size: 16),
                            label: const Text('Submit Exam ✓'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppTheme.accentGreen,
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                            ),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),

        // ── Picture-in-Picture Live AI Proctor Camera ──
        Positioned(
          top: 110,
          right: 12,
          child: AiProctorCameraBubble(
            strikeCount: _strikeCount,
            onWarningTriggered: _handleProctorWarning,
          ),
        ),
      ],
    );
  }

  Widget _buildModeButton({
    required IconData icon,
    required String tooltip,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: isSelected ? AppTheme.primary : Colors.transparent,
          borderRadius: BorderRadius.circular(6),
        ),
        child: Icon(
          icon,
          size: 18,
          color: isSelected ? Colors.white : AppTheme.textSecondary,
        ),
      ),
    );
  }

  Widget _buildAlternativeInputView(ExamQuestionItem q) {
    if (q.type == 'MCQ' && q.options != null) {
      return SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: q.options!.map((opt) {
            final isSelected = q.candidateAnswer == opt;
            return InkWell(
              onTap: () => _handleOptionSelected(opt),
              borderRadius: BorderRadius.circular(12),
              child: Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: isSelected ? AppTheme.primaryLight : AppTheme.bgSurface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: isSelected ? AppTheme.primary : AppTheme.cardBorder,
                    width: isSelected ? 2 : 1,
                  ),
                ),
                child: Row(
                  children: [
                    Icon(
                      isSelected ? Icons.radio_button_checked : Icons.radio_button_off,
                      color: isSelected ? AppTheme.primary : AppTheme.textSecondary,
                      size: 18,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(opt, style: TextStyle(fontWeight: isSelected ? FontWeight.w800 : FontWeight.w500)),
                    ),
                  ],
                ),
              ),
            );
          }).toList(),
        ),
      );
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            q.type == 'CODE' ? 'Write Code Implementation:' : 'Candidate Response (Typed):',
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12),
          ),
          const SizedBox(height: 8),
          TextFormField(
            controller: _answerController,
            maxLines: 12,
            style: TextStyle(
              fontFamily: q.type == 'CODE' ? 'monospace' : null,
              fontSize: 13,
              height: 1.4,
            ),
            decoration: InputDecoration(
              hintText: q.type == 'CODE' ? 'def solution():\n    # write code here...' : 'Enter your detailed solution explanation...',
              filled: true,
              fillColor: AppTheme.bgSurface,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: AppTheme.cardBorder),
              ),
            ),
            onChanged: (val) {
              _questions[_currentQuestionIndex].candidateAnswer = val;
              _questions[_currentQuestionIndex].isAnswered = val.trim().isNotEmpty;
            },
          ),
        ],
      ),
    );
  }
}
