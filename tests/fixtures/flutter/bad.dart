import 'package:flutter/material.dart';

class BadFlutterScreen extends StatelessWidget {
  const BadFlutterScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Colors.purple, Colors.cyan],
        ),
        borderRadius: BorderRadius.circular(36),
      ),
      child: Column(
        children: [
          Card(
            child: Card(
              child: Text('Nested card'),
            ),
          ),
          gradientTitle(),
          hardcodedTypography(),
          greyOnColor(),
          missingSemanticsAction(),
          repeatedPadding(),
        ],
      ),
    );
  }

  Widget gradientTitle() {
    return ShaderMask(
      shaderCallback: (bounds) {
        return const LinearGradient(
          colors: [Colors.purple, Colors.cyan],
        ).createShader(bounds);
      },
      child: const Text('Gradient title'),
    );
  }

  Widget hardcodedTypography() {
    return Column(
      children: const [
        Text('One', style: TextStyle(fontSize: 14)),
        Text('Two', style: TextStyle(fontSize: 16)),
        Text('Three', style: TextStyle(fontSize: 18)),
        Text('Four', style: TextStyle(fontSize: 20)),
      ],
    );
  }

  Widget greyOnColor() {
    return Container(
      color: Colors.indigo,
      child: const Text(
        'Muted on color',
        style: TextStyle(color: Colors.grey),
      ),
    );
  }

  Widget missingSemanticsAction() {
    return GestureDetector(
      onTap: () {},
      child: const Icon(Icons.close),
    );
  }

  Widget repeatedPadding() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: const Text('Same padding everywhere'),
          ),
        ),
      ),
    );
  }
}
