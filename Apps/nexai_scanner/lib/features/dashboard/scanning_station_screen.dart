import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import '../../models/scanning_models.dart';
import '../digitizer/rapid_booklet_digitizer_screen.dart';
import '../auth/session_key_screen.dart';
import '../../core/network/api_client.dart';

class ScanningStationScreen extends StatefulWidget {
  final ConnectedScanningSession session;

  const ScanningStationScreen({
    super.key,
    required this.session,
  });

  @override
  State<ScanningStationScreen> createState() => _ScanningStationScreenState();
}

class _ScanningStationScreenState extends State<ScanningStationScreen> {
  late final List<DigitizedBookletItem> _scannedBooklets;

  @override
  void initState() {
    super.initState();
    // Pre-populate with some initial booklets if CS201 demo session
    _scannedBooklets = [
      DigitizedBookletItem(
        id: 'SB-01',
        physicalBarcode: 'BC-990142',
        dummyBarcode: 'ANON-${widget.session.courseCode}-8940',
        pageCount: 16,
        scannedAt: DateTime.now().subtract(const Duration(minutes: 18)),
        ocrClarity: 99.4,
        sha256Digest: 'e3b0c44298fc1c149afbf4c8996fb924...',
        pageFilePaths: [],
      ),
      DigitizedBookletItem(
        id: 'SB-02',
        physicalBarcode: 'BC-990143',
        dummyBarcode: 'ANON-${widget.session.courseCode}-8941',
        pageCount: 16,
        scannedAt: DateTime.now().subtract(const Duration(minutes: 14)),
        ocrClarity: 98.9,
        sha256Digest: 'a591a6d40bf420404a011733cfb7b190...',
        pageFilePaths: [],
      ),
      DigitizedBookletItem(
        id: 'SB-03',
        physicalBarcode: 'BC-990144',
        dummyBarcode: 'ANON-${widget.session.courseCode}-8942',
        pageCount: 18,
        scannedAt: DateTime.now().subtract(const Duration(minutes: 8)),
        ocrClarity: 99.1,
        sha256Digest: '3b0c44298fc1c149afbf4c8996fb924a...',
        pageFilePaths: [],
      ),
    ];
  }

  Future<void> _openDigitizer() async {
    final nextIndex = _scannedBooklets.length + 1;
    final result = await Navigator.push<DigitizedBookletItem>(
      context,
      MaterialPageRoute(
        builder: (context) => RapidBookletDigitizerScreen(
          session: widget.session,
          bookletIndex: nextIndex,
        ),
      ),
    );

    if (result != null && mounted) {
      // Submit to backend
      try {
        await ApiClient.submitBooklet(
          sessionKey: widget.session.sessionKey,
          physicalBarcode: result.physicalBarcode,
          dummyBarcode: result.dummyBarcode,
          pageCount: result.pageCount,
          pageFilePaths: result.pageFilePaths,
          ocrClarity: result.ocrClarity,
          sha256Digest: result.sha256Digest,
        );
      } catch (e) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: AppTheme.accentRed,
            content: Text('Failed to submit booklet: $e'),
          ),
        );
        return;
      }

      setState(() {
        _scannedBooklets.insert(0, result);
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: AppTheme.accentGreen,
          content: Text('✓ Digitized & Sealed ${result.dummyBarcode} (${result.pageCount} pages)'),
          duration: const Duration(seconds: 2),
        ),
      );
    }
  }

  void _handleReconciliation() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.lock, color: AppTheme.primaryDark),
            SizedBox(width: 8),
            Text('Reconcile & Seal Batch'),
          ],
        ),
        content: Text(
          'Total Scanned: ${_scannedBooklets.length} of ${widget.session.expectedBooklets} Booklets.\n\n'
          'Are you ready to digitally lock this packet and push all packets directly to the central Scrutinizer/Evaluator pool?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(context);
              try {
                await ApiClient.reconcileBatch(
                  sessionKey: widget.session.sessionKey,
                  totalBooklets: _scannedBooklets.length,
                  totalPages: _scannedBooklets.fold<int>(0, (sum, b) => sum + b.pageCount),
                );
                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    backgroundColor: AppTheme.primaryDark,
                    content: Text('✓ Batch Dispatched & Signed with Station Private Key!'),
                  ),
                );
              } catch (e) {
                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    backgroundColor: AppTheme.accentRed,
                    content: Text('Dispatch failed: $e'),
                  ),
                );
              }
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primary),
            child: const Text('Confirm & Dispatch Batch ✓'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final count = _scannedBooklets.length;
    final totalPages = _scannedBooklets.fold<int>(0, (sum, b) => sum + b.pageCount);
    final percent = (count / widget.session.expectedBooklets * 100).clamp(0, 100).round();

    return Scaffold(
      backgroundColor: AppTheme.bgBase,
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.hub, color: AppTheme.primary, size: 16),
                const SizedBox(width: 6),
                Text(
                  widget.session.stationId,
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: AppTheme.textPrimary),
                ),
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppTheme.primaryLight,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    widget.session.sessionKey,
                    style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: AppTheme.primaryDark, fontFamily: 'monospace'),
                  ),
                ),
              ],
            ),
            Text(
              'Staff: ${widget.session.staffName}',
              style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary),
            ),
          ],
        ),
        actions: [
          IconButton(
            onPressed: () {
              Navigator.pushReplacement(
                context,
                MaterialPageRoute(builder: (context) => const SessionKeyScreen()),
              );
            },
            icon: const Icon(Icons.swap_horiz, color: AppTheme.textSecondary),
            tooltip: 'Switch Session Key',
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Session Progress Card
            Container(
              margin: const EdgeInsets.all(16),
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF1E293B), Color(0xFF0F172A)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.15),
                    blurRadius: 16,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            widget.session.courseCode,
                            style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w900),
                          ),
                          Text(
                            widget.session.courseTitle,
                            style: const TextStyle(color: Colors.white70, fontSize: 12),
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppTheme.primary,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          widget.session.hallNumber,
                          style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w800),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),

                  // Counters
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('BOOKLETS DIGITIZED', style: TextStyle(color: Colors.white60, fontSize: 10, fontWeight: FontWeight.w800)),
                          const SizedBox(height: 2),
                          Text(
                            '$count / ${widget.session.expectedBooklets}',
                            style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w900),
                          ),
                        ],
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          const Text('TOTAL PAGES', style: TextStyle(color: Colors.white60, fontSize: 10, fontWeight: FontWeight.w800)),
                          const SizedBox(height: 2),
                          Text(
                            '$totalPages Pages',
                            style: const TextStyle(color: AppTheme.accentGreen, fontSize: 20, fontWeight: FontWeight.w900),
                          ),
                        ],
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          const Text('PROGRESS', style: TextStyle(color: Colors.white60, fontSize: 10, fontWeight: FontWeight.w800)),
                          const SizedBox(height: 2),
                          Text(
                            '$percent%',
                            style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w900),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),

                  // Progress Bar
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: count / widget.session.expectedBooklets,
                      backgroundColor: Colors.white12,
                      valueColor: const AlwaysStoppedAnimation<Color>(AppTheme.accentGreen),
                      minHeight: 8,
                    ),
                  ),
                ],
              ),
            ),

            // Giant Primary Action Button: "Scan Next Physical Booklet"
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _openDigitizer,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primary,
                    padding: const EdgeInsets.symmetric(vertical: 18),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    elevation: 3,
                    shadowColor: AppTheme.primary.withValues(alpha: 0.3),
                  ),
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.add_a_photo, color: Colors.white, size: 22),
                      SizedBox(width: 10),
                      Text(
                        'Scan Next Physical Booklet',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Colors.white),
                      ),
                    ],
                  ),
                ),
              ),
            ),

            const SizedBox(height: 16),

            // Scanned Booklets Feed Header
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 18),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'COMPLETED IN THIS BATCH',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.8,
                      color: AppTheme.textSecondary,
                    ),
                  ),
                  TextButton.icon(
                    onPressed: _handleReconciliation,
                    icon: const Icon(Icons.inventory, size: 14, color: AppTheme.primaryDark),
                    label: const Text('Reconcile & Seal', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppTheme.primaryDark)),
                  ),
                ],
              ),
            ),

            // Feed List
            Expanded(
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                itemCount: _scannedBooklets.length,
                separatorBuilder: (context, idx) => const SizedBox(height: 10),
                itemBuilder: (context, idx) {
                  final b = _scannedBooklets[idx];

                  return Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppTheme.bgSurface,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: AppTheme.cardBorder),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 42,
                          height: 42,
                          decoration: BoxDecoration(
                            color: AppTheme.primaryLight,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Center(
                            child: Icon(Icons.document_scanner, color: AppTheme.primaryDark, size: 22),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                b.dummyBarcode,
                                style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13, fontFamily: 'monospace', color: AppTheme.primaryDark),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                'Barcode: ${b.physicalBarcode} • ${b.pageCount} Pages',
                                style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11),
                              ),
                            ],
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: const Color(0xFFE8F5F1),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.verified, size: 12, color: AppTheme.accentGreen),
                              const SizedBox(width: 4),
                              Text(
                                '${b.ocrClarity}%',
                                style: const TextStyle(color: AppTheme.accentGreen, fontSize: 10, fontWeight: FontWeight.w800),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
