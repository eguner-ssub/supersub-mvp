const MobileLayout = ({ children, bgImage }) => {
  return (
    <div
      className="min-h-screen flex items-center justify-center relative"
      style={bgImage ? {
        backgroundImage: `url('${bgImage}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      } : { backgroundColor: '#000' }}
    >
      {bgImage && <div className="absolute inset-0 bg-black/60 z-0" />}
      <div className={`w-full max-w-md relative ${bgImage ? 'z-10' : ''}`}>
        {children}
      </div>
    </div>
  );
};

export default MobileLayout;
