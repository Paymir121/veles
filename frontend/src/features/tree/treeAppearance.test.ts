import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_EDGE_STROKE_WIDTH,
  getEdgeStrokeWidth,
  MAX_EDGE_STROKE_WIDTH,
  MIN_EDGE_STROKE_WIDTH,
  scaleEdgeStrokeWidth,
  setEdgeStrokeWidth,
} from './treeAppearance';

describe('treeAppearance', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('falls back to the default width when nothing is stored', () => {
    expect(getEdgeStrokeWidth()).toBe(DEFAULT_EDGE_STROKE_WIDTH);
  });

  it('persists a rounded width to localStorage', () => {
    expect(setEdgeStrokeWidth(3.14)).toBe(3.1);
    expect(getEdgeStrokeWidth()).toBe(3.1);
  });

  it('clamps values outside the allowed range', () => {
    expect(setEdgeStrokeWidth(0)).toBe(MIN_EDGE_STROKE_WIDTH);
    expect(setEdgeStrokeWidth(101)).toBe(MAX_EDGE_STROKE_WIDTH);
  });

  it('ignores broken stored JSON', () => {
    window.localStorage.setItem('veles-tree-appearance', '{not json');
    expect(getEdgeStrokeWidth()).toBe(DEFAULT_EDGE_STROKE_WIDTH);
  });

  it('scales kind-specific widths relative to the default', () => {
    expect(scaleEdgeStrokeWidth(2.2, 2.2)).toBe(2.2);
    expect(scaleEdgeStrokeWidth(2.6, 4.4)).toBe(5.2);
  });
});
