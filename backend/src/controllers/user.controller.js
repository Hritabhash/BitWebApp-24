import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/Cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { Placement } from "../models/placement.model.js";

const generateAcessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating refresh and acess token!"
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  //   const { fullName, email, username, password } = req.body;
  const { username, password, fullName, rollNumber, email } = req.body;
  console.log("email:", email);
  if (
    [username, password, fullName, rollNumber, email].some(
      (field) => field?.trim() === ""
    )
  ) {
    throw new ApiError(400, "All fields are required:");
  }
  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });
  if (existedUser) {
    throw new ApiError(409, "User with email/username already exists");
  }
  const idLocalPath = req.files?.idCard[0]?.path;
  if (!idLocalPath) {
    throw new ApiError(400, "idCard file is required:");
  }
  const idCard = await uploadOnCloudinary(idLocalPath);
  if (!idCard) {
    throw new ApiError(400, "Avatar file is required:");
  }
  const user = await User.create({
    username: username.toLowerCase(),
    password,
    fullName,
    rollNumber,
    email,
    idCard: idCard.url,
  });
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }
  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  console.log(req.body);
  const { username, password } = req.body;
  console.log(username);
  if (!username) {
    throw new ApiError(400, "username is req");
  }
  const user = await User.findOne({ username: username.toLowerCase() });
  if (!user) {
    throw new ApiError(404, "User does not exists");
  }
  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid Credentials!");
  }
  const { accessToken, refreshToken } = await generateAcessAndRefreshToken(
    user._id
  );
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User loggedIn successfully!"
      )
    );
});
const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: { refreshToken: 1 },
    },
    {
      new: true,
    }
  );
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "User logged out successfully!"));
});

const updateUser1 = asyncHandler(async (req, res) => {
  const {
    fullName,
    rollNumber,
    email,
    branch,
    section,
    mobileNumber,
    semester,
    cgpa,
  } = req.body;

  const updateFields = {};

  if (fullName) updateFields.fullName = fullName;
  if (rollNumber) updateFields.rollNumber = rollNumber;
  if (email) updateFields.email = email;
  if (branch) updateFields.branch = branch;
  if (section) updateFields.section = section;
  if (mobileNumber) updateFields.mobileNumber = mobileNumber;
  if (semester) updateFields.semester = semester;
  if (cgpa) updateFields.cgpa = cgpa;

  if (Object.keys(updateFields).length === 0) {
    throw new ApiError(400, "At least one field is required for update");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    { $set: updateFields },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "User details updated successfully!"));
});
const getCurrentUser = asyncHandler(async (req, res) => {
  const _id = req?.user?._id;
  const user = await User.findById({ _id });
  if (!user) throw new ApiError(404, "user not found");
  res.status(200).json(new ApiResponse(200, user, "user fetched"));
});

const updatePlacementOne = asyncHandler(async (req, res) => {
  const { company, ctc, date } = req.body;
  console.log("company", company);
  if (!company || !ctc || !date) {
    throw new ApiError(400, "All fields are required");
  }
  const idLocalPath = req.files?.doc[0]?.path;
  if (!idLocalPath) {
    throw new ApiError(400, "doc file is required:");
  }
  const doc = await uploadOnCloudinary(idLocalPath);
  if (!doc) {
    throw new ApiError(400, "doc file is required:");
  }

  const placement = await Placement.create({
    student: req.user._id,
    company,
    ctc,
    date,
    doc: doc.url,
  });
  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        placementOne: placement._id,
      },
    },
    { new: true }
  );
  if (!updatedUser) {
    throw new ApiError(
      500,
      "Something went wrong while updating the placement details"
    );
  }
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updatedUser,
        "Placement details updated successfully!"
      )
    );
});
const updatePlacementTwo = asyncHandler(async (req, res) => {
  const { company, ctc, date } = req.body;
  console.log("company", company);
  if (!company || !ctc || !date) {
    throw new ApiError(400, "All fields are required");
  }
  const idLocalPath = req.files?.doc[0]?.path;
  if (!idLocalPath) {
    throw new ApiError(400, "doc file is required:");
  }
  const doc = await uploadOnCloudinary(idLocalPath);
  if (!doc) {
    throw new ApiError(400, "doc file is required:");
  }

  const placement = await Placement.create({
    student: req.user._id,
    company,
    ctc,
    date,
    doc: doc.url,
  });
  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        placementTwo: placement._id,
      },
    },
    { new: true }
  );
  if (!updatedUser) {
    throw new ApiError(
      500,
      "Something went wrong while updating the placement details"
    );
  }
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updatedUser,
        "Placement details updated successfully!"
      )
    );
});
const updatePlacementThree = asyncHandler(async (req, res) => {
  const { company, ctc, date } = req.body;
  console.log("company", company);
  if (!company || !ctc || !date) {
    throw new ApiError(400, "All fields are required");
  }
  const idLocalPath = req.files?.doc[0]?.path;
  if (!idLocalPath) {
    throw new ApiError(400, "doc file is required:");
  }
  const doc = await uploadOnCloudinary(idLocalPath);
  if (!doc) {
    throw new ApiError(400, "doc file is required:");
  }

  const placement = await Placement.create({
    student: req.user._id,
    company,
    ctc,
    date,
    doc: doc.url,
  });
  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        placementThree: placement._id,
      },
    },
    { new: true }
  );
  if (!updatedUser) {
    throw new ApiError(
      500,
      "Something went wrong while updating the placement details"
    );
  }
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updatedUser,
        "Placement details updated successfully!"
      )
    );
});
const getPlacementOne = asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate("placementOne");
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const placement = user.placementOne;
    if (!placement) {
      return res
        .status(200)
        .json(new ApiResponse(200, null, "No placement data found"));
    }

    return res
      .status(200)
      .json(
        new ApiResponse(200, placement, "Placement data retrieved successfully")
      );
  } catch (error) {
    throw new ApiError(
      500,
      "An error occurred while retrieving placement data"
    );
  }
});

const getUserbyRoll = asyncHandler(async (req, res) => {
  const { rollNumber } = req.body;

  // Finding the user by roll number and populating all the fields
  const user = await User.findOne({ rollNumber: rollNumber })
    .populate("placementOne")
    .populate("placementTwo")
    .populate("placementThree")
    .populate("proj")
    .populate("awards")
    .populate("higherEd")
    .populate("internShips")
    .populate("exams")
    .populate("academics")
    .select("-password -username");
  if (!user) {
    res.status(404).json(new ApiResponse(404, null, "User not found"));
    return;
  }

  res.status(200).json(new ApiResponse(200, user, "User data fetched"));
});
const getPlacementDetails = asyncHandler(async (req, res) => {
  try {
    const users = await User.find().populate([
      { path: "placementOne", select: "company ctc", model: Placement },
      { path: "placementTwo", select: "company ctc" },
      { path: "placementThree", select: "company ctc" },
    ]);
    const us = users.map((user) => ({
      fullName: user.fullName,
      rollNumber: user.rollNumber,
      branch: user.branch,
      placementOne: user.placementOne
        ? { company: user.placementOne.company, ctc: user.placementOne.ctc }
        : null,
      placementTwo: user.placementTwo
        ? { company: user.placementTwo.company, ctc: user.placementTwo.ctc }
        : null,
      placementThree: user.placementThree
        ? { company: user.placementThree.company, ctc: user.placementThree.ctc }
        : null,
    }));
    return res
      .status(200)
      .json(
        new ApiResponse(200, us, "Placement details fetched successfully!")
      );
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while fetching placement details"
    );
  }
});

export {
  registerUser,
  loginUser,
  logoutUser,
  updateUser1,
  updatePlacementOne,
  updatePlacementTwo,
  updatePlacementThree,
  getPlacementDetails,
  getCurrentUser,
  getUserbyRoll,
  getPlacementOne,
};
