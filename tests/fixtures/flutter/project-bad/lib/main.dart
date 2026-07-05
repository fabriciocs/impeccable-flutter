import 'package:flutter/material.dart';

class ProjectBad extends StatelessWidget {
  const ProjectBad({super.key});

  @override
  Widget build(BuildContext context) {
    return Card(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(40),
      ),
      child: const Text('Too round'),
    );
  }
}
