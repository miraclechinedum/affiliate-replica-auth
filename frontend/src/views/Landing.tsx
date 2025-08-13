import Header from "../components/Header";
import Footer from "../components/Footer";
export default () => (
  <div className="min-h-screen flex flex-col">
    <Header />
    <header
      className="relative bg-cover bg-center h-screen bg-[#e1ebdc]"
      style={{ backgroundImage: "url('hero3.jpg')" }}
    >
      <div className="absolute inset-0 bg-white opacity-30 xmd:opacity-0"></div>
      <div className="container max-w-8xl px-4 mx-auto h-full flex items-center relative z-10">
        <div className="w-full lg:w-1/2 text-black xp-4">
          <h1 className="text-5xl font-bold leading-tight mb-4">
            Begin Your Affiliate Journey Now
          </h1>
          <p className="text-xl mb-8">
            Start your affiliate journey today with Start Affiliate. Make your
            first commission and take the first step towards financial growth.
            It's easy, secure, and designed for you.
          </p>
          <a
            href="\program"
            className="bg-black hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-full text-lg transition duration-300"
          >
            Continue to Program
          </a>
        </div>
      </div>
    </header>
    <Footer />
  </div>
);
