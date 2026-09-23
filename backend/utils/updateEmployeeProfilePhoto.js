/** PATCH-style update for profile photo only (avoids full employee payload normalize wipe). */
export const createUpdateProfilePhotoHandler = (Employee) => async (req, res) => {
  try {
    const url = String(req.body?.profilePhoto ?? '').trim();
    if (!url) {
      return res.status(400).json({ message: 'profilePhoto URL is required' });
    }

    const updated = await Employee.findByIdAndUpdate(
      req.params.id,
      { profilePhoto: url },
      { new: true, runValidators: true }
    )
      .populate('designation')
      .populate('reportingManager', 'name email');

    if (!updated) return res.status(404).json({ message: 'Employee not found' });

    res.status(200).json({ message: 'Profile photo updated', employee: updated });
  } catch (error) {
    res.status(500).json({
      message: 'Error updating profile photo',
      error: error?.message || error,
    });
  }
};
