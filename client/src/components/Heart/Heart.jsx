import React, { useContext, useEffect, useState } from 'react'
import { AiFillHeart } from 'react-icons/ai'
import useAuthCheck from '../../hooks/useAuthCheck'
import { useMutation } from 'react-query'
import { useAuth0 } from '@auth0/auth0-react'
import UserDetailContext from '../../context/UserDetailContext'
import { checkFavourites, updateFavourites } from '../../utils/common'
import { toFav } from '../../utils/api'
function Heart({id}) {

    const [heartColor, setHeartColor] = useState("white")
    const {validateLogin} = useAuthCheck()
    const { user } = useAuth0()

    const {
        userDetails: { favourites, token },
        setUserDetails,
      } = useContext(UserDetailContext);

    useEffect(() => {
        if (Array.isArray(favourites) && favourites.length > 0) {
            setHeartColor(() => checkFavourites(id, favourites));
        }
    }, [favourites, id]);
    
    

    const {mutate} = useMutation({
        mutationFn: () => toFav(id, user?.email, token),
        onSuccess: ()=> {
            setUserDetails((prev)=> (
                {
                    ...prev,
                    favourites: updateFavourites(id, prev.favourites)
                }
            ))
        }
    })

    const handleLike = () => {
        if (validateLogin() && Array.isArray(favourites)) {
            mutate();
            setHeartColor((prev) => prev === "#fa3ef5" ? "white" : "#fa3ef5");
        }
    };
    
  return (
    <AiFillHeart size={24} color={heartColor} onClick={(e) => {
        e.stopPropagation()
        handleLike()
    }}></AiFillHeart>
  )
}

export default Heart