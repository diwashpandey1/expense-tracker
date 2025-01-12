import React, {useState} from "react";
import {Doughnut} from "react-chartjs-2";
import {Chart as ChartJS, ArcElement, Tooltip, Legend} from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

function SimpleInterestCalculator() {
   const [principal, setPrincipal] = useState(0);
   const [time, setTime] = useState(0);
   const [rate, setRate] = useState(0);
   const [currency, setCurrency] = useState("रु");
   const [simpleInterest, setSimpleInterest] = useState(null);
   const [totalAmount, setTotalAmount] = useState(null);

   const data = {
      labels: ["Principal", "Interest"],
      datasets: [
         {
            label: "Amount Distribution",
            data: [principal, simpleInterest || 0],
            backgroundColor: ["#4CAF50", "#FF6384"],
            hoverBackgroundColor: ["#45A049", "#FF4364"],
         },
      ],
   };

   const options = {
      responsive: true,
      cutout: "70%",
      plugins: {
         legend: {
            position: "top",
         },
      },
   };

   const handleCurrency = (e) => {
      setCurrency(e.target.value);
   };

   const handlePrincipal = (e) => {
      setPrincipal(Number(e.target.value));
   };

   const handleRate = (e) => {
      setRate(Number(e.target.value));
   };

   const handleTime = (e) => {
      setTime(Number(e.target.value));
   };

   const handleCalculatedResult = (e) => {
      e.preventDefault();
      const interest = (principal * rate * time) / 100;
      setSimpleInterest(interest);
      setTotalAmount(principal + interest);
   };

   return (
      <section className="w-full min-h-screen flex justify-center items-center bg-gray-50 p-6">
         <div className="w-full max-w-5xl flex flex-col gap-10 mt-10">
            {/* Title */}
            <h2 className="text-2xl font-semibold text-gray-700 mt-10">
               Simple Interest Calculator
            </h2>

            {/* Main Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               {/* Left Section */}
               <div className="bg-white p-6 rounded-lg shadow-md">
                  <form className="space-y-5" onSubmit={handleCalculatedResult}>
                     {/* Currency Selector */}
                     <div>
                        <label className="block text-gray-600 mb-2">
                           Currency ({currency})
                        </label>
                        <select
                           onChange={handleCurrency}
                           className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                           <option value="💸">Select Currency</option>
                           <option value="रु">NPR - Nepali Rupee (रु)</option>
                           <option value="$">USD - US Dollar ($)</option>
                           <option value="€">EUR - Euro (€)</option>
                           <option value="₹">INR - Indian Rupee (₹)</option>
                           <option value="¥">JPY - Japanese Yen (¥)</option>
                        </select>
                     </div>

                     {/* Principal Input */}
                     <div>
                        <label className="block text-gray-600 mb-2">
                           Principal (P)
                        </label>
                        <input
                           onChange={handlePrincipal}
                           type="number"
                           placeholder="Enter Principal"
                           className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                     </div>

                     {/* Time Input */}
                     <div>
                        <label className="block text-gray-600 mb-2">
                           Time (T)
                        </label>
                        <input
                           onChange={handleTime}
                           type="number"
                           placeholder="Enter Time in Years"
                           className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                     </div>

                     {/* Rate Input */}
                     <div>
                        <label className="block text-gray-600 mb-2">
                           Rate of Interest (R)
                        </label>
                        <input
                           onChange={handleRate}
                           type="number"
                           placeholder="Enter Rate in %"
                           className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                     </div>

                     {/* Calculate Button */}
                     <button
                        type="submit"
                        className="w-full bg-green-500 text-white py-2 rounded-lg hover:bg-green-600 transition duration-300">
                        Calculate
                     </button>
                  </form>
               </div>

               {/* Right Section */}
               <div className="bg-white p-6 rounded-lg shadow-md">
                  <div className="flex justify-center mb-6">
                     <div className="w-64 h-64">
                        <Doughnut data={data} options={options} />
                     </div>
                  </div>
                  <div className="space-y-4">
                     <p className="text-gray-600 flex justify-between">
                        <span>Principal Amount:</span>
                        <span className="text-lg font-bold text-green-500">
                           {currency + " " + principal}
                        </span>
                     </p>
                     <p className="text-gray-600 flex justify-between">
                        <span>Simple Interest:</span>
                        <span className="text-lg font-bold text-green-500">
                           {currency + " " + (simpleInterest || 0)}
                        </span>
                     </p>
                     <hr />
                     <p className="text-gray-600 flex justify-between">
                        <span>Total Amount:</span>
                        <span className="text-xl font-bold text-green-500">
                           {currency + " " + (totalAmount || 0)}
                        </span>
                     </p>
                  </div>
               </div>
            </div>

            {/* Bottom Information */}
            <div className="flex flex-col gap-6">
               {/* Formula Section */}
               <div className="bg-white p-6 rounded-lg shadow-md">
                  <h3 className="text-[1.7em] font-semibold mb-4">
                     Understanding Simple Interest
                  </h3>
                  <p className="mb-4 text-[#4b5563]">
                     Simple interest is a basic method of calculating interest
                     where interest is earned or charged only on the initial
                     principal amount. Unlike compound interest, the interest
                     earned does not earn additional interest over time.
                  </p>
                  <div className="py-6 px-4 bg-green-100 rounded-md shadow-md">
                     <h4 className="text-lg font-semibold mb-2">
                        Simple Interest Formula Explained
                     </h4>
                     <p className="mb-4 text-[#4b5563]">
                        SI = (P × R × T) / 100
                     </p>
                     <p className="text-[#4b5563]">
                        <span>Where:</span>
                        <br /> SI = Simple Interest
                        <br /> P = Principal amount (initial investment)
                        <br /> R = Interest rate (in decimal form)
                        <br /> T = Time period (in years)
                     </p>
                  </div>
               </div>

               {/* Applications Section */}
               <div className="bg-white p-6 rounded-lg shadow-md">
                  <h3 className="text-[1.7em] font-semibold mb-4">
                     When to Use Simple Interest
                  </h3>
                  <h4 className="text-lg font-semibold mb-2">
                     Common Applications
                  </h4>
                  <ul className="list-disc pl-5 mb-4">
                     <li>Short-term personal loans</li>
                     <li>Car loans and auto financing</li>
                     <li>Consumer loans</li>
                     <li>Bridge loans</li>
                     <li>Some types of mortgages</li>
                     <li>Education loans</li>
                  </ul>
                  <h4 className="text-lg font-semibold mb-2">Advantages</h4>
                  <ul className="list-disc pl-5">
                     <li>Easy to calculate and understand</li>
                     <li>Predictable payment amounts</li>
                     <li>Lower total interest compared to compound interest</li>
                     <li>Transparent interest charges</li>
                     <li>Suitable for short-term financial planning</li>
                  </ul>
               </div>

               {/* Tips and Considerations Section */}
               <div className="bg-white p-6 rounded-lg shadow-md">
                  <h3 className="text-[1.7em] font-semibold mb-4">
                     Tips and Considerations
                  </h3>
                  <div>
                     <div className="mb-4 px-4 py-3 border-l-[5px] border-l-green-500">
                        <span className="text-black text-lg font-semibold">
                           Compare Interest Rates
                        </span>
                        <p className="text-[#4b5563]">
                           Always compare interest rates from different lenders
                           before making a decision. Even a small difference in
                           interest rate can lead to significant savings.
                        </p>
                     </div>
                     <div className="mb-4 px-4 py-3 border-l-[5px] border-l-green-500">
                        <span className="text-black text-lg font-semibold">
                           Consider the Time Period
                        </span>
                        <p className=" text-[#4b5563]"> Longer loan terms mean more interest paid
                        overall. Consider if a shorter term with higher payments
                        might be more beneficial.
                        </p>
                     </div>
                     <div className="mb-4 px-4 py-3 border-l-[5px] border-l-green-500">
                        <span className="text-black text-lg font-semibold">
                           Check for Additional Fees
                        </span>
                        <p className=" text-[#4b5563]"> Besides interest, look for any processing fees,
                        prepayment penalties, or other charges that might affect
                        the total cost.
                        </p>
                     </div>
                  </div>
               </div>

               {/* Example Section */}
               <div className="bg-white p-6 rounded-lg shadow-md">
                  <h3 className="text-lg font-semibold mb-4">
                     Example Calculations
                  </h3>
                  <p className="mb-4">Let's look at some practical examples:</p>
                  <p className=" py-4 px-2 bg-gray-100 shadow-md rounded-md mb-4">
                     <strong>Example 1: Personal Loan</strong> <br />
                     Principal: $10,000 <br />
                     Interest Rate: 5% per year <br />
                     Time: 3 years <br />
                     Simple Interest = $10,000 × 0.05 × 3 = $1,500 <br />
                     Total Amount = $11,500
                  </p>
                  <p className="py-4 px-2 bg-gray-100 shadow-md rounded-md">
                     <strong>Example 2: Car Loan</strong> <br />
                     Principal: $20,000 <br />
                     Interest Rate: 4% per year <br />
                     Time: 5 years <br />
                     Simple Interest = $20,000 × 0.04 × 5 = $4,000 <br />
                     Total Amount = $24,000
                  </p>
               </div>
            </div>
         </div>
      </section>
   );
}

export default SimpleInterestCalculator;
