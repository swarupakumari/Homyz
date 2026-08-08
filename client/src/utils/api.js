import axios from "axios";
import dayjs from "dayjs";
import { toast } from "react-toastify";

export const api = axios.create({
  //baseURL: "https://homyz-real-estate-blush.vercel.app/api",
  baseURL: "https://homyz-iyy3-git-main-swars-projects-dd002804.vercel.app/api",
});

export const getAllProperties = async () => {
  try {
    const response = await api.get("/residency/allresd", {
      timeout: 10 * 1000,
    });

    if (response.status === 400 || response.status === 500) {
      throw response.data;
    }
    return response.data;
  } catch (error) {
    toast.error("Something went wrong");
    throw error;
  }
};

export const searchProperties = async (filters = {}) => {
  try {
    // Drop empty/undefined params so the query string stays clean
    // (e.g. no "?city=&country=" on an unfiltered search).
    const params = Object.fromEntries(
      Object.entries(filters).filter(
        ([, value]) => value !== undefined && value !== null && value !== ""
      )
    );

    const response = await api.get("/residency/search", {
      params,
      timeout: 10 * 1000,
    });

    if (response.status === 400 || response.status === 500) {
      throw response.data;
    }
    return response.data;
  } catch (error) {
    toast.error("Something went wrong while searching properties");
    throw error;
  }
};

// Note: intentionally does NOT toast on error like the other calls here —
// the AI search UI shows errors inline as chat messages, so the raw error
// is left for useAiSearch to translate into a friendly in-chat message.
export const aiSearchProperties = async (prompt) => {
  const response = await api.post(
    "/ai/search",
    { prompt },
    { timeout: 25 * 1000 }
  );
  return response.data;
};

// Sprint 4 — Agentic AI Property Advisor. `previousQueryAnalysis` is the
// exact `queryAnalysis` object from the prior response in this chat
// session (or null on the first turn); passing it back lets the backend
// planner treat this prompt as a refinement instead of a fresh search.
// Intentionally does NOT toast on error, same reasoning as aiSearchProperties.
export const getAgentAdvice = async (prompt, previousQueryAnalysis = null) => {
  const response = await api.post(
    "/agent/advice",
    { prompt, previousQueryAnalysis },
    { timeout: 40 * 1000 }
  );
  return response.data;
};

export const getProperty = async (id) => {
  try {
    const response = await api.get(`/residency/${id}`, {
      timeout: 10 * 1000,
    });

    if (response.status === 400 || response.status === 500) {
      throw response.data;
    }
    return response.data;
  } catch (error) {
    toast.error("Something went wrong");
    throw error;
  }
};

export const createUser = async (email, token) => {
  try {
    await api.post(
      `/user/register`,
      { email },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
  } catch (error) {
    toast.error("Something went wrong, Please try again");
    throw error;
  }
};

export const bookVisit = async (date, propertyId, email, token) => {
  try {
    if (!token) {
      toast.error("You need to be logged in.");
      return;
    }

    await api.post(
      `/user/bookVisit/${propertyId}`,
      {
        email,
        id: propertyId,
        date: dayjs(date).format("DD/MM/YYYY"),
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    toast.success("Visit booked successfully!");
  } catch (error) {
    toast.error("Something went wrong, Please try again");
    throw error;
  }
};

export const removeBooking = async (id, email, token) => {
  try {
    await api.post(
      `/user/removeBooking/${id}`,
      {
        email,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
  } catch (error) {
    toast.error("Something went wrong, Please try again");
  }
};

export const toFav = async (id, email, token) => {
  try {
    await api.post(
      `/user/toFav/${id}`,
      {
        email,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
  } catch (e) {
    throw e;
  }
};

export const getAllFav = async (email, token) => {
  if (!token) return;
  try {
    const res = await api.post(
      `/user/allFav`,
      {
        email,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return res.data["favResidenciesID"];
  } catch (error) {
    toast.error("Something went wrong while fetching favs");
    throw error;
  }
};

export const getAllBookings = async (email, token) => {
  if (!token) return;
  try {
    const res = await api.post(
      `/user/allBookings`,
      {
        email,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return res.data["bookedVisits"];
  } catch (error) {
    toast.error("Something went wrong while fetching favs");
    throw error;
  }
};

export const createResidency = async (data, token) => {
  console.log("Sending data:", data);
  try {
    const res = await api.post(
      `/residency/create`,
      { data },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
  } catch (error) {
    console.error("Error creating residency:", error);
    throw error;
  }
};
