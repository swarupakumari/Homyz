import React, { useContext, useState } from 'react'
import { useMutation, useQuery } from 'react-query'
import { useLocation } from 'react-router-dom'
import { getProperty } from '../../../utils/api'
import { PuffLoader } from "react-spinners"
import './Property.css'


import { FaShower } from 'react-icons/fa'
import { AiTwotoneCar } from 'react-icons/ai'
import { MdLocationPin, MdMeetingRoom } from 'react-icons/md'
import Map from '../../../components/Map/Map'
import useAuthCheck from '../../../hooks/useAuthCheck'
import { useAuth0 } from '@auth0/auth0-react'
import BookingModal from '../../../components/BookingModal/BookingModal'
import UserDetailContext from '../../../context/UserDetailContext'
import { Button } from '@mantine/core'
import { toast } from 'react-toastify'
import { removeBooking } from '../../../utils/api'
import Heart from '../../../components/Heart/Heart'

const Property = () => {
  const { pathname } = useLocation()
  const id = pathname.split("/").slice(-1)[0]
  const { data, isLoading, isError } = useQuery(["resd", id], () => getProperty(id))

  const [modalOpened, setModalOpened] = useState(false)

  const { validateLogin } = useAuthCheck()
  const { user } = useAuth0()


  const {
    userDetails: { token, bookings },
    setUserDetails,
  } = useContext(UserDetailContext)


  const {mutate: cancelBooking, isLoading: cancelling} = useMutation({
    mutationFn: ()=> removeBooking(id, user?.email, token),
    onSuccess: ()=> {
      setUserDetails((prev) => ({
        ...prev,
        bookings: prev.bookings.filter((booking) => booking?.id !== id)
      }))

      toast.success("Booking cancelled", {position: 'bottom-right'})
    }
  })

  if (isLoading) {
    return (
      <div className="wrapper">
        <div className="flexCenter paddings">
          <PuffLoader></PuffLoader>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="wrapper">
        <div className="flexCenter paddings">
          <span>Error while fetching the property details</span>
        </div>
      </div>
    )
  }
  return (
    <div className='wrapper'>
      <div className="flexColStart paddings innerWidth property-container">
        <div className="like">
          <Heart id={id}></Heart>
        </div>

        <img src={data?.image} alt="home image" />

        <div className="flexCenter property-details">
          <div className="flexColStart left">
            <div className="flexStart head">
              <span className='primaryText'>{data?.title}</span>
              <span className='orangeText' style={{ fontSize: '1.5rem' }}> $ {data?.price}</span>
            </div>

            <div className="flexStart facilities">
              <div className="flexStart facility">
                <FaShower size={20} color="#1f3e72"></FaShower>
                <span>{data?.facilities?.bathrroms} Bathrooms</span>
              </div>
              <div className="flexStart facility">
                <AiTwotoneCar size={20} color="#1f3e72"></AiTwotoneCar>
                <span>{data?.facilities?.parkings} Parkings</span>
              </div>
              <div className="flexStart facility">
                <MdMeetingRoom size={20} color="#1f3e72"></MdMeetingRoom>
                <span>{data?.facilities?.bedrooms} Room/s</span>
              </div>
            </div>

            <span className='secodaryText' style={{ textAlign: "justify" }}>
              {data?.description}
            </span>

            <div className="flexStart" style={{ gap: "1rem" }}>
              <MdLocationPin > </MdLocationPin>
              <span className='secondaryText'>
                {
                  data?.address
                }{" "}
                {
                  data?.city
                } {" "}
                {
                  data?.country
                }
              </span>

            </div>
            {bookings?.map((booking) => booking.id).includes(id) ? (
              <>
                <Button
                  variant="outline"
                  w={"100%"}
                  color="red"
                  onClick={() => cancelBooking()}
                  disabled={cancelling}
                >
                 <span>Cancel booking</span>
                </Button>
                 <span>
                    Your visit already booked for date {bookings?.filter((booking) => booking?.id === id)[0].date}
                  </span>
              </>

            ) : (
              <button
                className="button"
                onClick={() => {
                  validateLogin() && setModalOpened(true)
                }}>
                Book Your visit
              </button>
            )
            }


            <BookingModal
              opened={modalOpened}
              setOpened={setModalOpened}
              propertyId={id}
              email={user?.email}
            />
          </div>



          <div className="map">
            <Map address={data?.address} city={data?.city} country={data?.country}></Map>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Property