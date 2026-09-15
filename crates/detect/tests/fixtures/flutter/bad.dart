import 'package:flutter/material.dart';

Widget buildBad(BuildContext context) {
  return Container(
    decoration: BoxDecoration(
      borderRadius: BorderRadius.circular(40),
      gradient: const LinearGradient(
        colors: [Colors.purple, Colors.cyan],
      ),
    ),
    padding: const EdgeInsets.all(16),
    child: Card(
      child: Card(
        child: ShaderMask(
          shaderCallback: (bounds) => const LinearGradient(
            colors: [Colors.purple, Colors.cyan],
          ).createShader(bounds),
          child: const Text('Generated heading'),
        ),
      ),
    ),
  );
}

final style1 = TextStyle(fontSize: 12);
final style2 = TextStyle(fontSize: 14);
final style3 = TextStyle(fontSize: 16);
final style4 = TextStyle(fontSize: 18);

final pad1 = EdgeInsets.all(16);
final pad2 = EdgeInsets.all(16);
final pad3 = EdgeInsets.all(16);
final pad4 = EdgeInsets.all(16);

final action = GestureDetector(
  onTap: () {},
  child: const Icon(Icons.add),
);
