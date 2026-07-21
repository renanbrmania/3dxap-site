type LogoProps = {
  className?: string;
  /** Altura aproximada em pixels (largura acompanha a proporção do arquivo) */
  height?: number;
};

/** Logo oficial enviado pela 3DXAP (bico + tipografia) */
export function Logo({ className = "", height = 56 }: LogoProps) {
  return (
    <img
      src="/logo-3dxap.png"
      alt="3DXAP Impressão 3D"
      height={height}
      className={`w-auto object-contain ${className}`}
      style={{ height }}
    />
  );
}
