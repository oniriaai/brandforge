import { createElement, ReactElement } from 'react';
import {
  BackgroundSelectionResult,
  BrandKit,
  ContentAnalysisResult,
  LayoutGenerationResult,
} from '../types';

interface BuildTreeInput {
  width: number;
  height: number;
  content: ContentAnalysisResult;
  background: BackgroundSelectionResult;
  layout: LayoutGenerationResult;
  brandKit: BrandKit;
}

export function buildInstagramTree(input: BuildTreeInput): ReactElement {
  const { width, height, content, background, layout, brandKit } = input;
  const alignItems = layout.textAlign === 'left' ? 'flex-start' : 'center';
  const textAlign = layout.textAlign;

  return createElement(
    'div',
    {
      style: {
        width,
        height,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems,
        textAlign,
        padding: layout.padding,
        color: brandKit.textColor,
        background: `linear-gradient(135deg, ${background.gradientStart} 0%, ${background.gradientEnd} 100%)`,
        position: 'relative',
      },
    },
    createElement('div', {
      style: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: `rgba(0,0,0,${background.overlayOpacity})`,
      },
    }),
    createElement(
      'div',
      {
        style: {
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        },
      },
      createElement(
        'div',
        {
          style: {
            fontFamily: brandKit.headingFont,
            fontSize: Math.round(layout.headlineSize * 0.48),
            fontWeight: 600,
            opacity: 0.92,
            letterSpacing: 1,
            textTransform: 'uppercase',
          },
        },
        content.hook.toUpperCase(),
      ),
      createElement(
        'div',
        {
          style: {
            fontFamily: brandKit.headingFont,
            fontSize: layout.headlineSize,
            fontWeight: 800,
            lineHeight: 1.05,
            maxHeight: layout.lineClampHeadline * layout.headlineSize * 1.1,
            overflow: 'hidden',
          },
        },
        content.headline,
      ),
      createElement(
        'div',
        {
          style: {
            fontFamily: brandKit.bodyFont,
            fontSize: layout.bodySize,
            lineHeight: 1.3,
            maxWidth: '92%',
            maxHeight: layout.lineClampBody * layout.bodySize * 1.35,
            overflow: 'hidden',
            opacity: 0.96,
          },
        },
        content.body,
      ),
    ),
    createElement(
      'div',
      {
        style: {
          zIndex: 1,
          alignSelf: layout.textAlign === 'left' ? 'flex-start' : 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: brandKit.headingFont,
          fontSize: layout.ctaSize,
          fontWeight: 700,
          padding: '16px 28px',
          borderRadius: 9999,
          backgroundColor:
            layout.ctaStyle === 'solid' ? background.highlightColor : 'transparent',
          color:
            layout.ctaStyle === 'solid' ? brandKit.backgroundColor : background.highlightColor,
          border:
            layout.ctaStyle === 'outline'
              ? `2px solid ${background.highlightColor}`
              : '2px solid transparent',
        },
      },
      content.cta,
    ),
  );
}
