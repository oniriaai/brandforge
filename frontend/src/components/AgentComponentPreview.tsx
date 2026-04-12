import type { AgentComponentSpec } from '../types';

interface AgentComponentPreviewProps {
  spec: AgentComponentSpec;
}

function renderDecorativeLayer(layer: NonNullable<AgentComponentSpec['decorativeLayers']>[number], key: string) {
  const sharedStyle = {
    position: 'absolute' as const,
    left: layer.x - layer.size / 2,
    top: layer.y - layer.size / 2,
    width: layer.size,
    height: layer.size,
    opacity: layer.opacity,
    pointerEvents: 'none' as const,
  };

  if (layer.kind === 'ring') {
    return (
      <div
        key={key}
        style={{
          ...sharedStyle,
          borderRadius: '50%',
          border: `4px solid ${layer.color}`,
        }}
      />
    );
  }

  if (layer.kind === 'beam') {
    return (
      <div
        key={key}
        style={{
          ...sharedStyle,
          borderRadius: 9999,
          background: `linear-gradient(90deg, transparent 0%, ${layer.color} 45%, transparent 100%)`,
          transform: 'rotate(-24deg)',
        }}
      />
    );
  }

  if (layer.kind === 'mesh') {
    return (
      <div
        key={key}
        style={{
          ...sharedStyle,
          borderRadius: '50%',
          border: `2px dashed ${layer.color}`,
          background: 'transparent',
        }}
      />
    );
  }

  return (
    <div
      key={key}
      style={{
        ...sharedStyle,
        borderRadius: '50%',
        backgroundColor: layer.color,
      }}
    />
  );
}

function resolveLogoPlacementStyle(
  logoPlacement: NonNullable<AgentComponentSpec['logoPlacement']>,
): Record<string, number> {
  if (logoPlacement.position === 'top_left') {
    return { top: 24, left: 24 };
  }
  if (logoPlacement.position === 'top_right') {
    return { top: 24, right: 24 };
  }
  if (logoPlacement.position === 'bottom_left') {
    return { bottom: 24, left: 24 };
  }
  return { bottom: 24, right: 24 };
}

export default function AgentComponentPreview({ spec }: AgentComponentPreviewProps) {
  const previewWidth = 360;
  const scale = previewWidth / spec.width;
  const previewHeight = Math.round(spec.height * scale);
  const stitchImageUrl = spec.stitchArtifact?.imageUrl?.trim();
  const artifactFirstMode = Boolean(stitchImageUrl);
  const alignItems = spec.layout.textAlign === 'left' ? 'flex-start' : 'center';
  const decorativeLayers = spec.decorativeLayers ?? [];
  const badges = spec.badges ?? [];
  const surfaceStyle = spec.layout.surfaceStyle ?? 'none';
  const contentWidthRatio =
    typeof spec.layout.contentWidthRatio === 'number' && Number.isFinite(spec.layout.contentWidthRatio)
      ? Math.min(1, Math.max(0.6, spec.layout.contentWidthRatio))
      : 1;
  const contentWidth = artifactFirstMode
    ? Math.round(spec.width * 0.9)
    : Math.round(spec.width * contentWidthRatio);
  const panelBackground =
    surfaceStyle === 'glass'
      ? 'rgba(255,255,255,0.14)'
      : surfaceStyle === 'solid'
        ? 'rgba(0,0,0,0.26)'
        : 'transparent';
  const panelBorder =
    surfaceStyle === 'none' ? '0px solid transparent' : '1px solid rgba(255,255,255,0.18)';
  const panelBlur = surfaceStyle === 'glass' ? 'blur(8px)' : 'none';
  const overlayOpacity = artifactFirstMode
    ? Math.min(spec.background.overlayOpacity, 0.12)
    : spec.background.overlayOpacity;

  return (
    <div
      className="overflow-hidden rounded-lg border border-gray-200 bg-white"
      style={{ width: previewWidth, maxWidth: '100%', height: previewHeight }}
    >
      <div
        style={{
          width: spec.width,
          height: spec.height,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          alignItems,
          textAlign: spec.layout.textAlign,
          padding: spec.layout.padding,
          color: spec.brandKit.textColor,
          background: `linear-gradient(135deg, ${spec.background.gradientStart} 0%, ${spec.background.gradientEnd} 100%)`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {!artifactFirstMode &&
          decorativeLayers.map((layer, index) => renderDecorativeLayer(layer, `layer-${index}`))}
        {stitchImageUrl && (
          <img
            src={stitchImageUrl}
            alt="Stitch artifact preview"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        )}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: `rgba(0, 0, 0, ${overlayOpacity})`,
          }}
        />
        {badges.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: 24,
              right: 24,
              display: 'flex',
              gap: 10,
              zIndex: 2,
            }}
          >
            {badges.slice(0, 3).map((badge, index) => (
              <div
                key={`badge-${index}`}
                style={{
                  fontFamily: spec.brandKit.bodyFont,
                  fontSize: 18,
                  fontWeight: 600,
                  padding: '8px 12px',
                  borderRadius: 9999,
                  backgroundColor: 'rgba(255,255,255,0.18)',
                  border: '1px solid rgba(255,255,255,0.25)',
                  textTransform: 'capitalize',
                }}
              >
                {badge}
              </div>
            ))}
          </div>
        )}
        {spec.logoPlacement?.enabled && (
          <div
            style={{
              position: 'absolute',
              ...resolveLogoPlacementStyle(spec.logoPlacement),
              width: spec.logoPlacement.size,
              height: spec.logoPlacement.size,
              borderRadius:
                spec.logoPlacement.style === 'plain'
                  ? 8
                  : spec.logoPlacement.style === 'pill'
                    ? 9999
                    : 14,
              border: '1px solid rgba(255,255,255,0.35)',
              backgroundColor:
                spec.logoPlacement.style === 'plain' ? 'rgba(255,255,255,0.24)' : 'rgba(0,0,0,0.22)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2,
            }}
          >
            <div
              style={{
                fontFamily: spec.brandKit.headingFont,
                fontSize: Math.max(16, Math.round(spec.logoPlacement.size * 0.3)),
                fontWeight: 700,
                letterSpacing: 1,
              }}
            >
              LOGO
            </div>
          </div>
        )}
        {artifactFirstMode ? (
          <div
            style={{
              zIndex: 1,
              alignSelf: 'stretch',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: contentWidth,
              maxWidth: '100%',
              padding: '14px 18px',
              borderRadius: 18,
              border: '1px solid rgba(255,255,255,0.24)',
              background: 'rgba(8,12,24,0.54)',
              backdropFilter: 'blur(8px)',
              gap: 16,
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                maxWidth: '76%',
              }}
            >
              <div
                style={{
                  fontFamily: spec.brandKit.bodyFont,
                  fontSize: 14,
                  fontWeight: 600,
                  opacity: 0.84,
                  textTransform: 'uppercase',
                  letterSpacing: 0.8,
                }}
              >
                Stitch preview
              </div>
              <div
                style={{
                  fontFamily: spec.brandKit.headingFont,
                  fontSize: Math.max(22, Math.round(spec.layout.headlineSize * 0.34)),
                  fontWeight: 700,
                  lineHeight: 1.1,
                  maxHeight: 72,
                  overflow: 'hidden',
                }}
              >
                {spec.content.headline}
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: spec.brandKit.headingFont,
                fontSize: Math.max(14, Math.round(spec.layout.ctaSize * 0.65)),
                fontWeight: 700,
                padding: '10px 14px',
                borderRadius: 9999,
                backgroundColor: 'rgba(255,255,255,0.2)',
                border: '1px solid rgba(255,255,255,0.32)',
                whiteSpace: 'nowrap',
              }}
            >
              {spec.content.cta}
            </div>
          </div>
        ) : (
          <>
            <div
              style={{
                zIndex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
                width: contentWidth,
                maxWidth: '100%',
                padding: 24,
                borderRadius: 26,
                border: panelBorder,
                background: panelBackground,
                backdropFilter: panelBlur,
              }}
            >
              <div
                style={{
                  fontFamily: spec.brandKit.headingFont,
                  fontSize: Math.round(spec.layout.headlineSize * 0.48),
                  fontWeight: 600,
                  opacity: 0.92,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                }}
              >
                {spec.content.hook.toUpperCase()}
              </div>
              <div
                style={{
                  fontFamily: spec.brandKit.headingFont,
                  fontSize: spec.layout.headlineSize,
                  fontWeight: 800,
                  lineHeight: 1.05,
                  maxHeight: spec.layout.lineClampHeadline * spec.layout.headlineSize * 1.1,
                  overflow: 'hidden',
                }}
              >
                {spec.content.headline}
              </div>
              <div
                style={{
                  fontFamily: spec.brandKit.bodyFont,
                  fontSize: spec.layout.bodySize,
                  lineHeight: 1.3,
                  maxWidth: '92%',
                  maxHeight: spec.layout.lineClampBody * spec.layout.bodySize * 1.35,
                  overflow: 'hidden',
                  opacity: 0.96,
                }}
              >
                {spec.content.body}
              </div>
            </div>
            <div
              style={{
                zIndex: 1,
                alignSelf: spec.layout.textAlign === 'left' ? 'flex-start' : 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: spec.brandKit.headingFont,
                fontSize: spec.layout.ctaSize,
                fontWeight: 700,
                padding: '16px 28px',
                borderRadius: 9999,
                backgroundColor:
                  spec.layout.ctaStyle === 'solid' ? spec.background.highlightColor : 'transparent',
                color:
                  spec.layout.ctaStyle === 'solid'
                    ? spec.brandKit.backgroundColor
                    : spec.background.highlightColor,
                border:
                  spec.layout.ctaStyle === 'outline'
                    ? `2px solid ${spec.background.highlightColor}`
                    : '2px solid transparent',
              }}
            >
              {spec.content.cta}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
