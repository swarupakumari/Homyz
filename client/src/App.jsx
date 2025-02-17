import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './App.css'
import Websites from "./pages/Websites";
import { Suspense, useState } from 'react';
import Layout from './components/Layout/Layout';
import Properties from './pages/Properties/Properties';
import { QueryClient, QueryClientProvider } from 'react-query'
import { ReactQueryDevtools } from 'react-query/devtools'
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css'
import Property from './pages/Properties/property/Property';
import { MantineProvider } from '@mantine/core';
import UserDetailContext from './context/UserDetailContext';
import Bookings from './pages/Bookings/Bookings';
import Favourites from './pages/Favourites/Favourites';

function App() {
  const queryClient = new QueryClient()

  const [userDetails, setUserDetails] = useState({
    favourites: [],
    bookings: [],
    token: null
  })

  return (
    <UserDetailContext.Provider value={{ userDetails, setUserDetails }}>
      <QueryClientProvider client={queryClient}>

        <MantineProvider>
          <BrowserRouter>
            <Suspense fallback={<div>Loading...</div>}>
              <Routes>
                <Route element={<Layout></Layout>}>
                  <Route path='/' element={<Websites />}></Route>
                  <Route path='/properties'>
                    
                    <Route index element={<Properties></Properties>}></Route>
                    <Route path=':propertyId' element={<Property></Property>}></Route>

                  </Route>
                  <Route path='/bookings' element={<Bookings />} />
                  <Route path='/favourites' element={<Favourites />} />
                </Route>
              </Routes>
            </Suspense>
          </BrowserRouter>
        </MantineProvider>

        <ToastContainer></ToastContainer>
        <ReactQueryDevtools initialIsOpen={false}></ReactQueryDevtools>
      </QueryClientProvider>
    </UserDetailContext.Provider>



  );
}

export default App;
