const MobileLayout = ({ children, bgImage = '/bg-dashboard.webp' }) => {
  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 relative bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url('${bgImage}')` }}
    >
      {/* Black semi-transparent overlay */}
      <div className="absolute inset-0 bg-black/60 z-0"></div>
      <div className="w-full max-w-md relative z-10">
        {children}
      </div>
    </div>
  );
};

export default MobileLayout;
