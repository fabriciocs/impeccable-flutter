import 'package:flutter/material.dart';

class GoodFlutterScreen extends StatelessWidget {
  const GoodFlutterScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final colors = Theme.of(context).colorScheme;

    return Card(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Account health', style: textTheme.titleLarge),
            const SizedBox(height: 12),
            Text(
              'Clear hierarchy from the app theme.',
              style: textTheme.bodyMedium?.copyWith(color: colors.onSurfaceVariant),
            ),
            const SizedBox(height: 20),
            Semantics(
              button: true,
              label: 'Close account health panel',
              child: Tooltip(
                message: 'Close',
                child: InkWell(
                  onTap: () {},
                  child: const Icon(Icons.close),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
