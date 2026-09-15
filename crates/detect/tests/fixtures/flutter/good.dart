import 'package:flutter/material.dart';

Widget buildGood(BuildContext context) {
  final textTheme = Theme.of(context).textTheme;
  final colors = Theme.of(context).colorScheme;

  return Semantics(
    button: true,
    label: 'Add item',
    child: InkWell(
      onTap: () {},
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: colors.surfaceContainer,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          child: Text('Add', style: textTheme.labelLarge),
        ),
      ),
    ),
  );
}
